#!/bin/bash

npx tsc
rm -rf ./dist
mv ./out/src ./dist
rm -rf ./out
