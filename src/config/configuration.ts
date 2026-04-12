export default () => ({
    port: parseInt(process.env.PORT!) || 3000,
    databaseConf : {
        username: process.env.dbUserName,
        password: process.env.dbPassword,
        databaseName: process.env.dbName,
        type: process.env.dbType,
        port: process.env.dbPort,
        host: process.env.dbHost
    },
    jwt : {
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES,
        JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES
    },
    httpOnlyExpires: process.env.HTTP_ONLY_EXPIRES
})