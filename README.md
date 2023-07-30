# file-scanner-bot

## NodeJS
* curl -sL https://deb.nodesource.com/setup_14.x | sudo bash -
* sudo apt -y install nodejs

## MongoDB
* apt -y install gnupg
* wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
* echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
* 
* echo "deb http://security.ubuntu.com/ubuntu focal-security main" | sudo tee /etc/apt/sources.list.d/focal-security.list
* apt -y update
* apt -y install libssl1.1
* apt -y install -y mongodb-org
* 
* apt install systemctl
* systemctl start mongod
* mongosh
* 
* db.createUser({user: "<MONGO_DB_USER>", pwd: "<MONGO_DB_PASS>", roles: ["dbAdmin"]})