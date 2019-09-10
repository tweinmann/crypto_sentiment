db.createUser(
        {
            user: "user",
            pwd: "secret",
            roles: [
                {
                    role: "readWrite",
                    db: "crypto_sentiment"
                }
            ]
        }
);