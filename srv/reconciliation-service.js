module.exports = (srv) => {
  require('./handlers/seed-handler')(srv);
  require('./handlers/upload-handler')(srv);
  require('./handlers/matching-handler')(srv);
  require('./handlers/kpi-handler')(srv);
};