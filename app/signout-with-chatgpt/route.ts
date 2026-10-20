export function GET() {
  return new Response(null,{status:302,headers:{Location:"/signout","Cache-Control":"no-store"}});
}
