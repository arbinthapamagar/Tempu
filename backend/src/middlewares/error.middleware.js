const errorMiddleware = (err, req, res, next) => {
    // MongoDB unique-index violation: say which field clashed instead of
    // surfacing "E11000 duplicate key error collection: …" to the user.
    if (err?.code === 11000) {
        const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'value';
        return res.status(409).json({
            success: false,
            message: `That ${field} is already in use.`,
            errors: [],
        });
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        success: false,
        message,
        errors: err.errors || [],
    });
};

export { errorMiddleware };
