# Overview

This is a fork of the open-source [Documenso](https://github.com/documenso/documenso) project. It is a document signing application.

# Getting started developing

## Starting the dev server

Before starting up the project locally, install Node 22 (if not already installed) and switch to Node version 22: `nvm install 22 && nvm use 22`. Also, Docker will need to be running.

Run `cd docker/development && ./cert_gen.sh && cd ../..` to create the development certificate. It also creates the directories necessary and moves the certificate to the appropriate place.

Go to [Random Key Generation](https://randomkeygen.com/) and pick three "CodeIgnitor Encryption Keys" to use for the two private encryption keys and NEXTAUTH_SECRET.

Create an `.env` file wiht the key substitutions that looks like

```
NEXT_PRIVATE_ENCRYPTION_KEY={32_CHARS_LONG}
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY={32_CHARS_LONG}
NEXT_PUBLIC_DISABLE_SIGNUP=true
NEXT_PUBLIC_WEBAPP_URL=http://localhost:3000
NEXT_PRIVATE_INTERNAL_WEBAPP_URL=http://localhost:3000
NEXTAUTH_SECRET={SECRET_PHRASE OR KEY GEN TOOL}
NEXT_PRIVATE_DATABASE_URL=postgres://documenso:password@localhost:54320/documenso
NEXT_PRIVATE_DIRECT_DATABASE_URL=postgres://documenso:password@localhost:54320/documenso
```

In the root of the project, run `npm run d`. This command runs many steps to install the packages, run a Docker compose script to start the Postgres database, and seed the database. The application will be accessible at localhost:3000.

The default username and password for the admin user is `admin@documenso.com` and `password`.

## One final step

The project comes from Documenso with Git hooks. Run `rm -rf .git/hooks && git config --unset core.hookspath` to remove.
