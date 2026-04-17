#var/www/html
NEXT_PUBLIC_API_TARGET=prod pnpm run build
sftp -P 2222 stweb23@iubns.net:/home/stweb23/www << EOF
rm -R *
put -r ./out/* ./
EOF