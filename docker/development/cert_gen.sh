#!/bin/bash

openssl genrsa -out cert.key 2048
openssl req -new -x509 -config cert.cnf -noenc -days 720 -key cert.key -out cert.pem
openssl pkcs12 -export -keypbe NONE -certpbe NONE -nodes -nomac -in cert.pem -inkey cert.key -out cert.p12

cd ../../apps && mkdir -p web/resources && cp ../docker/development/cert.p12 web/resources/certificate.p12