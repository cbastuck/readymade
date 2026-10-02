# Make sure to build from root before
# docker build . -f hkp-rt/Dockerfile -t hkp-rt

docker run --rm --name hkp-rt-test \
  -p 8890:8890 \
  -v hkp-rt-data:/home/hkp/.hkp \
  -e PORT=8890 \
  -e HKP_EXTERNAL_URL=http://127.0.0.1:8890 \
  -e AUTH0_DOMAIN=hookitapp.eu.auth0.com \
  -e AUTH0_AUDIENCE=gpk8IFPKfaOTQUzpDRO7vBajOnB72rkM \
  -e ALLOWED_EMAILS=cby@mailbox.org \
  hkp-rt