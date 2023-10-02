## [API]

Scaling:	$12.00/mo – Pro 1 GB RAM | 1 vCPU  x  1

name:		api

run:		node ./dist/apps/api/main.js

port:		8090

routes:		/api,/

## [ticker]

Scaling:	$12.00/mo – Pro 1 GB RAM | 1 vCPU  x  3

name:		ticker

run:		node ./dist/apps/ticker/main.js

port:		8092

routes:		/ticker

## [feeder]

Scaling:	$25.00/mo – Pro 2 GB RAM | 1 vCPU  x  1

name:		feeder

run:		node ./dist/apps/feeder/main.js

port:		8091

routes:		/feeder


## [trader]

Scaling:	$25.00/mo – Pro 2 GB RAM | 1 vCPU  x  1

name:		trader

run:		node ./dist/apps/trader/main.js

port:		8091

routes:		/trader
