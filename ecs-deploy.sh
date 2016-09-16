#!/bin/bash

aws --version
aws configure set default.region us-east-1
aws configure set default.output json

# dev branch settings
if [[ "$CIRCLE_BRANCH" == "dev" ]];then
 export ECS_TASK_DEFINITION="deploybot-task-dev"
 export ECS_SERVICE="deploybot-dev"
 export ECS_CLUSTER="DeployBot-Dev"
else
 #TODO: PRODUCTION SETTINGS
 export ECS_TASK_DEFINITION=""
 export ECS_SERVICE=""
 export ECS_CLUSTER=""
fi

echo "preparing task definition"
aws ecs describe-task-definition --task-definition "$ECS_TASK_DEFINITION" | jq --arg x $CIRCLE_SHA1 ' .taskDefinition
                                                                                              | del(.status)
                                                                                              | del(.taskDefinitionArn)
                                                                                              | del(.revision)
                                                                                              | del(.requiresAttributes)
                                                                                              | .containerDefinitions[0].image = ("blackbook/deploybot:"+$x)' > new-task-definition.json

NEW_REVISION=$(aws ecs register-task-definition --cli-input-json file://new-task-definition.json | jq '.taskDefinition.revision')

echo "updating service definition"
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" --task-definition "$ECS_TASK_DEFINITION:$NEW_REVISION"
