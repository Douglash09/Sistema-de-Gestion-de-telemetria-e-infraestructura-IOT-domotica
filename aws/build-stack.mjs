import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'aws','build');mkdirSync(out,{recursive:true});
const read=p=>readFileSync(path.join(root,p),'utf8');
const ref=name=>({Ref:name}), att=(name,key)=>({'Fn::GetAtt':[name,key]}), sub=s=>({'Fn::Sub':s});
const resource=(Type,Properties,extra={})=>({Type,Properties,...extra});
const assets=Object.fromEntries(['index.html','app.js','styles.css'].map(name=>[name,read('public/'+name)]));
const assetHash=createHash('sha256').update(JSON.stringify(assets)).digest('hex');
const publisher=`const {S3Client,PutObjectCommand}=require('@aws-sdk/client-s3');
const assets=${JSON.stringify(assets)};
exports.handler=async e=>{
 let status='SUCCESS',reason='Assets published';
 try{if(e.RequestType!=='Delete'){const s3=new S3Client({});for(const [Key,Body] of Object.entries(assets))await s3.send(new PutObjectCommand({Bucket:e.ResourceProperties.Bucket,Key,Body,ContentType:Key.endsWith('.html')?'text/html; charset=utf-8':Key.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8',CacheControl:'no-cache'}));}}
 catch(err){status='FAILED';reason=err.name;}
 const body=JSON.stringify({Status:status,Reason:reason,PhysicalResourceId:e.PhysicalResourceId||e.StackId+'/frontend',StackId:e.StackId,RequestId:e.RequestId,LogicalResourceId:e.LogicalResourceId,Data:{Version:e.ResourceProperties.Version}});
 const result=await fetch(e.ResponseURL,{method:'PUT',headers:{'Content-Type':''},body});if(!result.ok)throw Error('CloudFormation callback failed');
};`;
const trust={Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]};
const r={};
r.Table=resource('AWS::DynamoDB::Table',{BillingMode:'PAY_PER_REQUEST',AttributeDefinitions:[{AttributeName:'PK',AttributeType:'S'},{AttributeName:'SK',AttributeType:'S'}],KeySchema:[{AttributeName:'PK',KeyType:'HASH'},{AttributeName:'SK',KeyType:'RANGE'}],TimeToLiveSpecification:{AttributeName:'expires',Enabled:true},SSESpecification:{SSEEnabled:true}},{DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain'});
r.Readings=resource('AWS::DynamoDB::Table',{BillingMode:'PAY_PER_REQUEST',AttributeDefinitions:[{AttributeName:'SensorId',AttributeType:'S'},{AttributeName:'Timestamp',AttributeType:'S'}],KeySchema:[{AttributeName:'SensorId',KeyType:'HASH'},{AttributeName:'Timestamp',KeyType:'RANGE'}],TimeToLiveSpecification:{AttributeName:'expires',Enabled:true},SSESpecification:{SSEEnabled:true}},{DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain'});
r.Bucket=resource('AWS::S3::Bucket',{PublicAccessBlockConfiguration:{BlockPublicAcls:true,IgnorePublicAcls:true,BlockPublicPolicy:true,RestrictPublicBuckets:true},OwnershipControls:{Rules:[{ObjectOwnership:'BucketOwnerEnforced'}]},BucketEncryption:{ServerSideEncryptionConfiguration:[{ServerSideEncryptionByDefault:{SSEAlgorithm:'AES256'}}]}},{DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain'});
r.Api=resource('AWS::ApiGatewayV2::Api',{Name:sub('${AWS::StackName}-api'),ProtocolType:'HTTP'});
r.ApiRole=resource('AWS::IAM::Role',{AssumeRolePolicyDocument:trust,Policies:[{PolicyName:'DashboardData',PolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['dynamodb:GetItem','dynamodb:Query','dynamodb:PutItem','dynamodb:UpdateItem','dynamodb:DeleteItem'],Resource:[att('Table','Arn'),att('Readings','Arn')]},{Effect:'Allow',Action:['logs:CreateLogStream','logs:PutLogEvents'],Resource:att('ApiLogs','Arn')}]}}]});
r.ApiLogs=resource('AWS::Logs::LogGroup',{LogGroupName:sub('/aws/lambda/${AWS::StackName}-api'),RetentionInDays:7});
r.Function=resource('AWS::Lambda::Function',{FunctionName:sub('${AWS::StackName}-api'),Runtime:'nodejs22.x',Handler:'index.handler',Role:att('ApiRole','Arn'),MemorySize:256,Timeout:90,Code:{ZipFile:read('aws/lambda/dashboard.cjs')},Environment:{Variables:{TABLE_NAME:ref('Table'),READINGS_TABLE:ref('Readings'),ADMIN_EMAIL:ref('AdminEmail'),ADMIN_SALT:ref('AdminSalt'),ADMIN_HASH:ref('AdminHash'),APP_ORIGIN:sub('https://${Distribution.DomainName}')}}});
r.Integration=resource('AWS::ApiGatewayV2::Integration',{ApiId:ref('Api'),IntegrationType:'AWS_PROXY',IntegrationUri:att('Function','Arn'),PayloadFormatVersion:'2.0',TimeoutInMillis:30000});
r.Route=resource('AWS::ApiGatewayV2::Route',{ApiId:ref('Api'),RouteKey:'ANY /api/{proxy+}',Target:{'Fn::Join':['/', ['integrations',ref('Integration')]]}});
r.Stage=resource('AWS::ApiGatewayV2::Stage',{ApiId:ref('Api'),StageName:'$default',AutoDeploy:true,DefaultRouteSettings:{ThrottlingBurstLimit:20,ThrottlingRateLimit:10}});
r.ApiPermission=resource('AWS::Lambda::Permission',{Action:'lambda:InvokeFunction',FunctionName:ref('Function'),Principal:'apigateway.amazonaws.com',SourceArn:sub('arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${Api}/*/*/api/*')});
r.Schedule=resource('AWS::Events::Rule',{ScheduleExpression:'rate(1 minute)',State:ref('SimulatorState'),Targets:[{Arn:att('Function','Arn'),Id:'Simulation',Input:'{"source":"domotix.simulator"}',RetryPolicy:{MaximumRetryAttempts:0}}]});
r.SchedulePermission=resource('AWS::Lambda::Permission',{Action:'lambda:InvokeFunction',FunctionName:ref('Function'),Principal:'events.amazonaws.com',SourceArn:att('Schedule','Arn')});
r.OriginAccess=resource('AWS::CloudFront::OriginAccessControl',{OriginAccessControlConfig:{Name:sub('${AWS::StackName}-s3'),OriginAccessControlOriginType:'s3',SigningBehavior:'always',SigningProtocol:'sigv4'}});
r.SecurityHeaders=resource('AWS::CloudFront::ResponseHeadersPolicy',{ResponseHeadersPolicyConfig:{Name:sub('${AWS::StackName}-security'),SecurityHeadersConfig:{ContentTypeOptions:{Override:true},FrameOptions:{FrameOption:'DENY',Override:true},ReferrerPolicy:{ReferrerPolicy:'same-origin',Override:true},StrictTransportSecurity:{AccessControlMaxAgeSec:31536000,IncludeSubdomains:true,Preload:false,Override:true},ContentSecurityPolicy:{ContentSecurityPolicy:"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",Override:true}}}});
const cache={ResponseHeadersPolicyId:ref('SecurityHeaders'),TargetOriginId:'web',ViewerProtocolPolicy:'redirect-to-https',AllowedMethods:['GET','HEAD','OPTIONS'],CachedMethods:['GET','HEAD'],Compress:true,MinTTL:0,DefaultTTL:0,MaxTTL:0,ForwardedValues:{QueryString:false,Cookies:{Forward:'none'}}};
r.Distribution=resource('AWS::CloudFront::Distribution',{DistributionConfig:{Enabled:true,DefaultRootObject:'index.html',PriceClass:'PriceClass_100',HttpVersion:'http2',ViewerCertificate:{CloudFrontDefaultCertificate:true},Origins:[{Id:'web',DomainName:att('Bucket','RegionalDomainName'),OriginAccessControlId:ref('OriginAccess'),S3OriginConfig:{OriginAccessIdentity:''}},{Id:'api',DomainName:sub('${Api}.execute-api.${AWS::Region}.amazonaws.com'),CustomOriginConfig:{HTTPSPort:443,OriginProtocolPolicy:'https-only',OriginSSLProtocols:['TLSv1.2']}}],DefaultCacheBehavior:cache,CacheBehaviors:[{...cache,PathPattern:'/api/*',TargetOriginId:'api',AllowedMethods:['GET','HEAD','OPTIONS','POST','PUT','PATCH','DELETE'],ForwardedValues:{QueryString:true,Cookies:{Forward:'all'},Headers:['Origin','Content-Type','X-API-Key']}}]}});
r.BucketPolicy=resource('AWS::S3::BucketPolicy',{Bucket:ref('Bucket'),PolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'cloudfront.amazonaws.com'},Action:'s3:GetObject',Resource:sub('${Bucket.Arn}/*'),Condition:{StringEquals:{'AWS:SourceArn':sub('arn:${AWS::Partition}:cloudfront::${AWS::AccountId}:distribution/${Distribution}')}}},{Effect:'Deny',Principal:'*',Action:'s3:*',Resource:[att('Bucket','Arn'),sub('${Bucket.Arn}/*')],Condition:{Bool:{'aws:SecureTransport':'false'}}}]}});
r.PublisherLogs=resource('AWS::Logs::LogGroup',{LogGroupName:sub('/aws/lambda/${AWS::StackName}-publish'),RetentionInDays:7});
r.PublisherRole=resource('AWS::IAM::Role',{AssumeRolePolicyDocument:trust,Policies:[{PolicyName:'PublishFrontend',PolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:'s3:PutObject',Resource:sub('${Bucket.Arn}/*')},{Effect:'Allow',Action:['logs:CreateLogStream','logs:PutLogEvents'],Resource:att('PublisherLogs','Arn')}]}}]});
r.Publisher=resource('AWS::Lambda::Function',{FunctionName:sub('${AWS::StackName}-publish'),Runtime:'nodejs22.x',Handler:'index.handler',Role:att('PublisherRole','Arn'),Timeout:60,MemorySize:128,Code:{ZipFile:publisher}});
r.WebFiles=resource('Custom::FrontendFiles',{ServiceToken:att('Publisher','Arn'),Bucket:ref('Bucket'),Version:assetHash});
const template={AWSTemplateFormatVersion:'2010-09-09',Description:'DomotiX dashboard - CloudFront, private S3, HTTP API, Lambda, DynamoDB',Parameters:{AdminEmail:{Type:'String',Default:'douglas.mendez1@catolica.edu.sv'},AdminSalt:{Type:'String',NoEcho:true,MinLength:16},AdminHash:{Type:'String',NoEcho:true,AllowedPattern:'[a-f0-9]{128}'},SimulatorState:{Type:'String',Default:'ENABLED',AllowedValues:['ENABLED','DISABLED']}},Resources:r,Outputs:{DashboardUrl:{Value:sub('https://${Distribution.DomainName}')},ApiUrl:{Value:sub('https://${Distribution.DomainName}/api')},DirectApiUrl:{Value:sub('https://${Api}.execute-api.${AWS::Region}.amazonaws.com/api')},BucketName:{Value:ref('Bucket')},TableName:{Value:ref('Table')},ReadingsTableName:{Value:ref('Readings')},FunctionName:{Value:ref('Function')}}};
writeFileSync(path.join(out,'cloudformation.json'),JSON.stringify(template,null,2));
writeFileSync(path.join(out,'manifest.json'),JSON.stringify({builtAt:new Date().toISOString(),frontendSha256:assetHash,backendSha256:createHash('sha256').update(read('aws/lambda/dashboard.cjs')).digest('hex')},null,2));
console.log('Plantilla generada: aws/build/cloudformation.json ('+Buffer.byteLength(JSON.stringify(template))+' bytes)');
if(process.argv.includes('--use-local-access')) {
  const { DatabaseSync }=await import('node:sqlite');
  const db=new DatabaseSync(path.join(root,'data','telemetry.sqlite'),{readOnly:true});
  const user=db.prepare('SELECT email,salt,hash FROM users WHERE email=?').get('douglas.mendez1@catolica.edu.sv');db.close();
  if(!user)throw Error('No existe el usuario compartido local');
  template.Parameters.AdminEmail.Default=user.email;
  template.Parameters.AdminSalt.Default=user.salt;
  template.Parameters.AdminHash.Default=user.hash;
  writeFileSync(path.join(out,'cloudformation-ready.json'),JSON.stringify(template,null,2));
  console.log('Plantilla privada preparada con el hash local. No publicar aws/build.');
}
