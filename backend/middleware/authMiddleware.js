const jwt = require("jsonwebtoken");
const RevokedToken = require("../models/RevokedToken");

module.exports = async (req, res , next) => {
    const authHeader = req.headers['authorization'] || "";
    const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;

    if(!token){
        return res.status(401).json({
            message : "No token provided"
        });
    }

    try{
        const revokedToken = await RevokedToken.exists({ token });

        if (revokedToken) {
            return res.status(401).json({
                message: "Token has been revoked"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        req.token = token;
        next();
    }
    catch(err){
        res.status(401).json({
            message : "Invalid token"
        });
    }
};
