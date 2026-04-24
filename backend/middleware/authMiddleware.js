const jwt = require("jsonwebtoken");

module.exports = (req, res , next) => {
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch(err){
        res.status(401).json({
            message : "Invalid token"
        });
    }
};
