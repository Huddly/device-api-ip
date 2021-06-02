#!/usr/bin/env bash

set -eu

BASEDIR=$(dirname "$0")
cd ${BASEDIR}/../

function finish {
  rm -rf proto
}
trap finish EXIT

rm -rf ./src/proto ./lib
mkdir -p ./src/proto ./lib/src/proto proto

cp node_modules/@huddly/sdk/proto/* src/proto/
cp node_modules/@huddly/sdk/proto/*.js lib/src/proto

npm run build-ts
npm run tslint
