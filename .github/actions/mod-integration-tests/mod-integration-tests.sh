#!/bin/bash

if [ $# != 2 ]; then
  echo "Usage:
	mod-integration-tests <mod> <modFolder>"
  exit 1
fi


modName=$1
modFolder=$2

# build list of resource types in this mod
resources=$(/tmp/turbot inspect --dir "$modFolder" --output-template "{% for resource, def in mod[\"resource\"][\"types\"] %}{{ resource }} {% endfor %}")
echo $resources
cd integration-tests

# now run integration tests
cd "$TURBOT_INTEGRATION_ROOT"
tests=""
for resource in ${resources[@]}; do
  # build test prefix to find tests for this resource
  testPrefix="$modName-$resource-"
  for testFolder in tests/$testPrefix*; do
    if [ -d "$testFolder" ]; then
        test=${testFolder##*/}
        tests="$tests $test"
    fi
  done
done

#echo $tests

echo make $tests
