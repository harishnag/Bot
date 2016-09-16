#!/bin/sh

set -e
CURRENT_COMMIT_HASH=$(cd "/Track2/credit" && git rev-parse HEAD)
CURRENT=$(cd `dirname $0` && pwd)
ROOT=$(dirname $CURRENT)

RUNENV=$1


if [ -z "$1" ];then
    echo "env  is required"
    exit 1
fi

if [ -z "$2" ];then
    echo "commit hash  is required"
    exit 1
fi

RUNDIR="/Track2"
if [ ! -d  "$RUNDIR" ];then
    echo "/Track2/credit folder is not present!"
    exit 1
fi

#git pull latest repo
cd "$RUNDIR"  && \
    git pull origin master && \
    git checkout $2

echo "Tests are being run based on the lastest commit $CURRENT_COMMIT_HASH"

cd "$RUNDIR/credit" && \
    gulp test:e2e:$RUNENV




