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
    const vpc = new sst.aws.Vpc('DocumensoVPC');
    const db = new sst.aws.Postgres('DocumensoDB', {
      vpc,
      dev: {
        username: 'documenso',
        password: 'password',
        database: 'documenso',
        port: 54320,
      },
      database: 'documenso',
    });

    const webApp = new sst.aws.Remix('DocumensoWebApp', {
      path: 'apps/remix/',
      link: [db],
      environment: {
        NEXT_PRIVATE_DATABASE_URL: $interpolate`postgres://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}`,
        NEXT_PRIVATE_DIRECT_DATABASE_URL: $interpolate`postgres://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}`,
      },
    });

    return {
      WebAppUrl: webApp.url,
    };
  },
});
