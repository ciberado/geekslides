# Automated deployment

## Configuration

```bash
export PREFIX=<a-very-unique-prefix>
export SUFFIX=$(uuidgen)
```

## Infrastructure creation

```bash
az group create --name $PREFIX-rg --location westeurope

az storage account create \
  --name ${PREFIX}sa \
  -g $PREFIX-rg \
  --kind StorageV2 \
  --sku Standard_LRS

az storage blob service-properties update \
  --account-name ${PREFIX}sa \
  --static-website \
  --404-document 404.html \
  --index-document index.html \
  --output table  
```

## Build and deploy

```
rm -fr .cache dist
parcel build --public-url . src/index.html

az storage blob upload-batch \
  --account-name ${PREFIX}sa \
  --source dist \
  --destination \$web/$SUFFIX \
  --output table
```

## Site check

```
BASE_URL=$(\
  az storage account show \
    --name ${PREFIX}sa \
    --query "primaryEndpoints.web" \
    --output tsv)

URL=$BASE_URL/$SUFFIX/index.html
```

## Deployment to AWS

```
BUCKET_NAME=<bucket name>
DIRECTORY=aws-security-notes

rm -fr dist .cache
parcel build --public-url . src/index.html
aws s3 cp ./dist s3://$BUCKET_NAME --recursive
```

## PDF generation

```
mkdir screenshots
decktape --load-pause 300 -s 1920x1080 --screenshots $URL tmp-$RANDOM.pdf


sudo apt install imagemagick -y
sudo rm /etc/ImageMagick-6/policy.xml

cd screenshots
ls -v *.png | tr '\n' ' ' | sed 's/$/\ slides.pdf/' | xargs convert
```


## Nginx location configuration

```nginx
server {
	listen 80 default_server;
	listen [::]:80 default_server;

	root /var/www/<server_name>/html;

	index index.html index.htm index.nginx-debian.html;

	server_name _;

	location / {
		try_files $uri $uri/ =404;
	}
}


server {

    root /var/www/<server_name>/html;

    index index.html index.htm index.nginx-debian.html;
    server_name <server_name>; 

    location /mqtt {
        proxy_pass http://127.0.0.1:8883;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";        
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /presentations {
        proxy_pass http://127.0.0.1:8081/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        proxy_pass http://127.0.0.1:1234;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    listen 443 ssl;
    ssl_certificate <server_name>.crt; 
    ssl_certificate_key <server_name>.key; 
}

server {
    if ($host = <server_name>) {
        return 301 https://$host$request_uri;
    } 

    listen 80 ;
    server_name <server_name>;
    return 404; 
}

```