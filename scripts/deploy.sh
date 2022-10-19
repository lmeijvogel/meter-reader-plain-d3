#!/bin/sh

source ./.env

yarn build
rsync --recursive --delete-during --verbose dist/* $PRODUCTION_LOCATION

# Delete the data again, since otherwise it will interfere with
# development.
#
# (note that parcel will regenerate the files for dev anyway,
# but that's no problem)
rm -rf dist/*
