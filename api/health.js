
module.exports = function handler(req, res) {
  return res.status(200).json({
    status: 'ok',
    source: 'vercel-function',
  });
};
