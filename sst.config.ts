/* eslint-disable turbo/no-undeclared-env-vars */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'documenso',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      protect: ['production'].includes(input?.stage),
      home: 'aws',
      providers: {
        aws: {
          region: (process.env.AWS_REGION as aws.Region) || 'us-west-2',
        },
      },
    };
  },
  async run() {
    // TODO: use static VPC get to obtain the existing VPC
    const vpc = new sst.aws.Vpc('DocumensoVpc');
    const cluster = new sst.aws.Cluster('DocumensoCluster', { vpc });
    const db = new sst.aws.Postgres('DocumensoDB', {
      vpc,
      dev: {
        database: 'documenso',
        username: 'documenso',
        password: 'password',
        port: 54320,
      },
    });
    const api = new sst.aws.ApiGatewayV2('DocumensoApi', { vpc });
    const documentBucket = new sst.aws.Bucket('DocumensoDocumentBucket');
    const nextAuthSecret = new sst.Secret('NextAuthSecret', crypto.randomUUID());
    const encryptionKey = new sst.Secret('EncryptionKey', crypto.randomUUID());
    const encryptionSecondaryKey = new sst.Secret('EncryptionSecondaryKey', crypto.randomUUID());
    const service = new sst.aws.Service('DocumensoService', {
      cluster,
      image: {
        dockerfile: 'docker/Dockerfile',
      },
      link: [db, documentBucket],
      environment: {
        PORT: '3000',
        NEXTAUTH_SECRET: nextAuthSecret.value,
        NEXT_PRIVATE_ENCRYPTION_KEY: encryptionKey.value,
        NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY: encryptionSecondaryKey.value,
        NEXT_PUBLIC_WEBAPP_URL: api.url,
        NEXT_PRIVATE_INTERNAL_WEBAPP_URL: api.url,
        NEXT_PRIVATE_DATABASE_URL: $interpolate`postgres://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}`,
        NEXT_PRIVATE_DIRECT_DATABASE_URL: $interpolate`postgres://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}`,
        NEXT_PRIVATE_SMTP_TRANSPORT: process.env.NEXT_PRIVATE_SMTP_TRANSPORT ?? 'smtp-auth',
        NEXT_PRIVATE_SMTP_FROM_NAME:
          process.env.NEXT_PRIVATE_SMTP_FROM_NAME ?? 'No Reply @ Documenso',
        NEXT_PRIVATE_SMTP_FROM_ADDRESS:
          process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS ?? 'noreply@documenso.com',
        NEXT_PRIVATE_UPLOAD_TRANSPORT: 's3',
        NEXT_PRIVATE_UPLOAD_ENDPOINT: documentBucket.domain,
        NEXT_PRIVATE_UPLOAD_FORCE_PATH_STYLE: 'true',
        NEXT_PRIVATE_UPLOAD_REGION: 'us-west-2',
        NEXT_PRIVATE_UPLOAD_BUCKET: documentBucket.name,
        // Add other required env vars from render.yaml as needed
      },
      serviceRegistry: {
        port: 80,
      },
      // If you need to mount a cert, see SST docs for EFS/S3 mounting
      // volumes: [
      //   { source: "/mnt/efs/cert.p12", containerPath: "/opt/documenso/cert.p12" }
      // ],
    });

    api.routePrivate('$default', service.nodes.cloudmapService.arn);
  },
});
