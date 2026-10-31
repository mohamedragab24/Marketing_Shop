export function GET() {
  return Response.json({
    status: 'ok',
    service: 'dbguide-api',
    runtime: 'Node.js',
    timestamp: new Date().toISOString(),
  });
}
