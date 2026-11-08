// `opennextjs-cloudflare build` が生成する Next.js 用の Worker。
// @ts-ignore: ビルドしないと存在しない
import openNext from "../.open-next/worker.js";

/** Service Binding。呼び出し先の Worker を、公開 URL を経由せずに直接呼ぶ。 */
interface ServiceBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  /** draftgg-api の Worker */
  API: ServiceBinding;
}

interface OpenNextHandler {
  fetch(request: Request, env: Env, ctx: unknown): Promise<Response>;
}

const nextHandler = openNext as OpenNextHandler;

/** ブラウザは同一オリジンの /api だけを叩く。api は別 Worker なので、ここで中継する。 */
function isApiRequest(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export default {
  fetch(request: Request, env: Env, ctx: unknown): Promise<Response> {
    if (isApiRequest(new URL(request.url).pathname)) {
      return env.API.fetch(request);
    }
    return nextHandler.fetch(request, env, ctx);
  },
};
