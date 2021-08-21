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
