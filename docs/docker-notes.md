# Docker notes and commands
random docker notes and commands to help me remember how things work when coming back to make changes, and figure out how to debug things when something goes wrong.


## General docker commands

#### pass a shell command(in this case find | head) into image(cup-api:local)
docker run --rm --entrypoint sh cup-api:local -c "find /app -type f | head -50"

#### run image with interactive shell
docker run --rm -it --entrypoint sh cup-api:local

#### build only up to a specific stage(builder here)
docker build --target builder -t cup-api:builder -f apps/api/Dockerfile .




## API

#### build api local:
docker build -f apps/api/Dockerfile -t cup-api:local .

#### API main local run command (important to include name=cup-api, used by bouncer and other containers to reference it)
docker run --rm --network cup_default --name cup-api -p 3000:3000 --env-file .env.docker cup-api:local





## Bouncer

#### build bouncer server
docker build -f games/bouncer/server/Dockerfile -t cup-bouncer:local .


#### run bouncer server
docker run --rm --network cup_default --name bouncer-server -p 4001:4001 --env-file .env.docker cup-bouncer:local