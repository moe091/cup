# Docker notes and commands
random docker notes and commands to help me remember how things work when coming back to make changes, and figure out how to debug things when something goes wrong.


#### API main local run command
docker run --rm --network cup_default -p 3000:3000 --env-file .env.docker cup-api:local

#### pass a shell command(in this case find | head) into image(cup-api:local)
docker run --rm --entrypoint sh cup-api:local -c "find /app -type f | head -50"

#### run image with interactive shell
docker run --rm -it --entrypoint sh cup-api:local


#### build api local:
docker build -f apps/api/Dockerfile -t cup-api:local .


#### build only up to a specific stage(builder here)
docker build --target builder -t cup-api:builder -f apps/api/Dockerfile .


#### run api:local with env vars
docker run --rm   --network cup_default   -p 3000:3000   -e DATABASE_URL="postgresql://postgres:postgres@flowt:5432/flowt_dev"   -e SESSION_SECRET="local-test-secret"   cup-api:local
