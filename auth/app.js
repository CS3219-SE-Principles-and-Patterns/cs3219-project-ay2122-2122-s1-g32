const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const admin = require("firebase-admin");
const checkAuthWithFirebase = require("./middleware/checkAuthWithFirebase.middleware");

const serviceAccount = require("./config/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const pairingRouter = require("./routes/pairing.routes");
const roomRouter = require("./routes/room.routes");
const historyRouter = require("./routes/history.routes");

const app = express();

app.use(cors());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.get("/hello", (req, res) => {
  res.json({
    message: "hello world",
  });
});

app.use("/", checkAuthWithFirebase);

app.use("/pairing", pairingRouter);
app.use("/room", roomRouter);
app.use("/history", historyRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.status(err.status || 500).json({
    message: "Invalid request.",
  });
});

module.exports = app;
