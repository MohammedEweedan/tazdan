FROM postgres:16-alpine
RUN apk add --no-cache aws-cli && mkdir -p /backups && chown postgres:postgres /backups
COPY db-backup.sh /usr/local/bin/tazdan-backup
RUN chmod 755 /usr/local/bin/tazdan-backup
USER postgres
ENTRYPOINT ["sh", "-c", "while true; do if sh /usr/local/bin/tazdan-backup; then sleep 86400; else echo '[backup] FAILED; retrying in five minutes'; sleep 300; fi; done"]
