#!/bin/bash

# set -x
# set -o
# set -e

aws --version
aws configure set default.region us-east-1
aws configure set default.output json

export ECS_TASK_DEFINITION=$1
export ECS_CLUSTER=$2
export ECS_SERVICE=$3
export SHA=$4
export IMAGE_NAME=$5
export CONFIG_URL=$6


#Get the current version of the tasks running in the service
CURRENT_TASK_DEF_NUM=$(aws ecs describe-task-definition --task-definition "$ECS_TASK_DEFINITION" | jq '.taskDefinition.revision')

echo "preparing task definition"
aws ecs describe-task-definition --task-definition "$ECS_TASK_DEFINITION" | jq --arg x $SHA --arg img $IMAGE_NAME  --arg config_url $CONFIG_URL ' .taskDefinition
                                                                                              | del(.status)
                                                                                              | del(.taskDefinitionArn)
                                                                                              | del(.revision)
                                                                                              | del(.requiresAttributes)
                                                                                              | .containerDefinitions[0].image = ($img+":"+$x)
                                                                                              | (.containerDefinitions[].environment[] | select(.name =="CONFIG_URL")).value=$config_url '> new-task-definition.json

NEW_REVISION=$(aws ecs register-task-definition --cli-input-json file://new-task-definition.json | jq '.taskDefinition.revision')

echo "updating service definition"
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" --task-definition "$ECS_TASK_DEFINITION:$NEW_REVISION"

#NEW_REVISION_ARN=$(aws ecs describe-task-definition --task-definition "$ECS_TASK_DEFINITION:$NEW_REVISION" | jq -r .taskDefinition.taskDefinitionArn)

# See if the service is able to come up again
#TIMEOUT=30
#every=10
#i=0
#while [ $i -lt $TIMEOUT ]
#do
  # Scan the list of running tasks for that service, and see if one of them is the
  # new version of the task definition
#  rm -f tasks

#aws ecs list-tasks --cluster $ECS_CLUSTER  --service-name $ECS_SERVICE --desired-status RUNNING 
#    | jq '.taskArns[]' \
#    | xargs -I{} aws ecs describe-tasks --cluster $ECS_CLUSTER --tasks {} >> tasks

#  jq < tasks > results ".tasks[]| if .taskDefinitionArn == \"$NEW_REVISION_ARN\" then . else empty end|.lastStatus"

#  RUNNING=`grep -e "RUNNING" results`

#  if [ "$RUNNING" ]; then
#    echo "service updated successfully, new task definition $ecs_task_definition:$new_revision running. ";
#    exit 0
#  fi
 
aws ecs wait services-stable --cluster $ECS_CLUSTER --services $ECS_SERVICE


if [ $? -eq 0 ];then
echo "service updated successfully, new task definition $ECS_TASK_DEFINITION:$NEW_REVISION running. ";
exit 0
elif [ $? -gt 0 ];then
echo "service failed to stabilize"
echo "rolling back the service definition"
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" --task-definition "$ECS_TASK_DEFINITION:$CURRENT_TASK_DEF_NUM"
exit 1
fi


#  sleep $every
#  i=$(( $i + $every ))
#  echo "elapsed time $i"
#done

## Timeout
#echo "ERROR: New task definition not running within $TIMEOUT seconds"
#echo "rolling back the service definition"
#aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" --task-definition "$ECS_TASK_DEFINITION:$CURRENT_TASK_DEF_NUM"
#exit 1
