const GONE_JSON = '{"error":"此兌換入口已停用"}';

export async function POST() {
  return new Response(GONE_JSON, {
    status: 410,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
