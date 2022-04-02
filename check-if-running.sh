#!/bin/bash
if npx forever list | grep -q "src/index.js"; 
	then
		echo "process running"
	else
		npx forever start -o forever-log.out -e forever-error.log src/index.js
fi