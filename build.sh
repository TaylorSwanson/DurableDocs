#!/bin/bash

npx tsc
rm -rf ./dist
mkdir -p ./dist
mv ./out/src ./dist
rm -rf ./out
