#!/bin/bash

if [ $(($(date +%M) % 15)) -ne 0 ]; then
    exit
fi

cd $OPENSHIFT_REPO_DIR

node parse.js
