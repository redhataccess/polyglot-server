#!/bin/bash

minute=$(date +%M)
if [ $((10#$minute % 30)) -ne 0 ]; then
    exit
fi

cd $OPENSHIFT_REPO_DIR
node parse.js
