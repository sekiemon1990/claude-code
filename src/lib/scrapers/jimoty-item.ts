import * as cheerio from "cheerio";

/**
 * ジモティー個別商品ページの追加データ取得 (description, images 等)
 * URL 例: https://jmty.jp/[prefecture]/sale-[cat]/article-[id]
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

export type JimotyItemDetail = {
  id: string;
  description?: string;
  images?: string[];
  price?: number;
  sellerName?: string;
  sellerUrl?: string;
  sellerRating?: string;
  location?: string;
};

// 改行を保持しつつ余分な空白を整える
function preserveBreaks(text: string): string {
  return text
    // タブと連続空白は 1 個のスペースに
    .replace(/[ \t　]+/g, " ")
    // 連続改行 (3 つ以上) は 2 つに圧縮
    .replace(/\n{3,}/g, "\n\n")
    // 各行の先頭・末尾スペースを除去
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    // 先頭末尾の空行を除去
    .trim();
}

// JSON-LD 構造化データから price を再帰的に探す
function findJsonLdPrice(node: unknown, depth = 0): number | undefined {
  if (depth > 8) return undefined;
  if (!node) return undefined;
  if (Array.isArray(node)) {
    for (const c of node) {
      const v = findJsonLdPrice(c, depth + 1);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  if (typeof node !== "object") return undefined;
  const o = node as Record<string, unknown>;
  // 直接の price フィールド
  const direct = o.price;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  if (typeof direct === "string") {
    const n = Number(direct.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  // offers.price (Schema.org Product)
  const offers = o.offers;
  if (offers) {
    const v = findJsonLdPrice(offers, depth + 1);
    if (v !== undefined) return v;
  }
  // priceSpecification.price
  const priceSpec = o.priceSpecification;
  if (priceSpec) {
    const v = findJsonLdPrice(priceSpec, depth + 1);
    if (v !== undefined) return v;
  }
  // 一般的な再帰
  for (const v of Object.values(o)) {
    const r = findJsonLdPrice(v, depth + 1);
    if (r !== undefined) return r;
  }
  return undefined;
}

// HTML から改行を保持してテキスト抽出 (<br>/<p>/<div> を改行に変換)
function htmlToTextWithBreaks(htmlSnippet: string): string {
  return htmlSnippet
    // script/style/noscript ブロックを中身ごと除去
    // (Google Tag Manager のスクリプト等が本文に混入するのを防ぐ)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export async function scrapeJimotyItem(
  fullUrl: string,
): Promise<JimotyItemDetail> {
  // URL から ID 抽出
  const idMatch = fullUrl.match(/article-([a-z0-9_]+)/i);
  const id = idMatch?.[1] ?? "";

  console.log("[jimoty-item] fetching:", fullUrl);

  const res = await fetch(fullUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
    redirect: "follow",
  });

  console.log("[jimoty-item] status:", res.status, "final:", res.url);
  if (!res.ok) {
    throw new Error(`商品ページ取得エラー: ${res.status}`);
  }

  const html = await res.text();
  console.log("[jimoty-item] html size:", html.length);

  const $ = cheerio.load(html);

  // script/style/noscript/iframe を除外しておく
  // (商品説明探索で Google Tag Manager のスクリプト内容を本文として
  //  誤検出することがあるため)
  $("script, style, noscript, iframe").remove();

  // 商品説明: メインの説明欄を探す
  let description: string | undefined;
  // よくある class 名 / 構造を試す (実際の Jimoty レイアウトに合わせて)
  const candidates = [
    ".p-article-body__description",
    ".p-article__description",
    "[data-testid='article-description']",
    ".article-text",
    ".article__description",
    ".article-body",
    ".article-detail__text",
    ".article-detail__description",
    ".article__body",
    ".jmty-article__text",
    "[itemprop='description']",
    "[class*='description']",
    "[class*='Description']",
    "main p",
  ];
  for (const sel of candidates) {
    const $el = $(sel).first();
    if (!$el.length) continue;
    // HTML を取って <br>/<p> を改行に変換してから text 化する (改行保持)
    const innerHtml = $el.html() ?? "";
    const text = htmlToTextWithBreaks(innerHtml).trim();
    if (text && text.length > 30) {
      description = preserveBreaks(text).slice(0, 5000);
      console.log("[jimoty-item] description found via:", sel, "len:", text.length);
      break;
    }
  }
  // フォールバック: 最も長いテキストブロックを採用 (<p> / <div> / <section>)
  if (!description || description.length < 100) {
    let longest = "";
    let longestTag = "";
    // article / main の中の <div> / <p> / <section> を全部見る
    const $main = $("main, article, .main, [role='main']").first();
    const $scope = $main.length ? $main : $("body");
    $scope.find("p, div, section").each((_, el) => {
      const $el = $(el);
      // 子要素にも <p> や <div> があれば skip (重複カウント防止)
      if ($el.find("p, div").length > 5) return;
      const innerHtml = $el.html() ?? "";
      const t = htmlToTextWithBreaks(innerHtml).trim();
      if (t.length > longest.length && t.length < 10000) {
        longest = t;
        longestTag = (el as { tagName?: string; name?: string }).tagName || (el as { name?: string }).name || "";
      }
    });
    if (longest.length > 100) {
      description = preserveBreaks(longest).slice(0, 5000);
      console.log(
        "[jimoty-item] description via longest text block tag:",
        longestTag,
        "len:",
        longest.length,
      );
    }
  }
  // 最後の保険: meta description (SEO 用で truncated されていることが多い)
  if (!description) {
    const metaDesc =
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim();
    if (metaDesc) {
      description = metaDesc;
      console.log("[jimoty-item] description via meta (truncated SEO ver.)");
    }
  }

  // 画像: 複数枚
  const imageSet = new Set<string>();
  // og:image を最優先
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) imageSet.add(ogImage);
  // 商品画像っぽい img 要素
  $('img[src*="jmty.jp/articles/images"]').each((_, el) => {
    const src = $(el).attr("src");
    if (src) imageSet.add(src);
  });
  // gallery 系の class があれば
  $('[class*="gallery"] img, [class*="Gallery"] img').each((_, el) => {
    const src = $(el).attr("src");
    if (src && src.includes("jmty.jp")) imageSet.add(src);
  });
  const images = Array.from(imageSet);

  // 価格: 商品ページから抽出 (¥X,XXX 形式)
  let price: number | undefined;
  const priceCandidates = [
    ".p-article-body__price",
    "[data-testid='price']",
    ".article-price",
    ".article__price",
    "[itemprop='price']",
    "[class*='price']",
    "[class*='Price']",
  ];
  for (const sel of priceCandidates) {
    const $el = $(sel).first();
    if (!$el.length) continue;
    // content 属性 (microdata)
    const content = $el.attr("content");
    if (content) {
      const n = Number(content.replace(/[^\d]/g, ""));
      if (Number.isFinite(n) && n >= 0) {
        price = n;
        console.log("[jimoty-item] price via content attr of:", sel);
        break;
      }
    }
    const text = $el.text().replace(/\s+/g, "");
    const m = text.match(/[¥￥]\s?([\d,]+)|([\d,]+)\s?円/);
    if (m) {
      const n = Number((m[1] ?? m[2]).replace(/,/g, ""));
      if (Number.isFinite(n)) {
        price = n;
        console.log("[jimoty-item] price via text of:", sel);
        break;
      }
    }
  }
  // フォールバック: og:price:amount (使われていれば)
  if (price === undefined) {
    const ogPrice =
      $('meta[property="product:price:amount"]').attr("content") ||
      $('meta[property="og:price:amount"]').attr("content");
    if (ogPrice) {
      const n = Number(ogPrice.replace(/[^\d]/g, ""));
      if (Number.isFinite(n)) {
        price = n;
        console.log("[jimoty-item] price via og:price meta");
      }
    }
  }
  // 価格 selector 候補のテキスト一覧を常に出力 (診断用)
  const priceProbe = $('[class*="price" i], [data-testid*="price" i]')
    .map((_, el) => {
      const $el = $(el);
      const cls = $el.attr("class") ?? "";
      const id = $el.attr("id") ?? "";
      const txt = $el.text().trim().slice(0, 80);
      return `<${(el as { name?: string }).name ?? ""}> #${id} .${cls} | ${txt}`;
    })
    .get()
    .slice(0, 15);
  console.log("[jimoty-item] price probe candidates:", priceProbe);

  // dt/dd でラベルされた価格パターンも探す (例: <dt>価格</dt><dd>10,000円</dd>)
  if (price === undefined) {
    $("dt, th, label").each((_, el) => {
      if (price !== undefined) return false;
      const $el = $(el);
      const labelText = $el.text().replace(/\s/g, "");
      if (/価格|料金|金額/.test(labelText)) {
        const $next = $el.next();
        if ($next.length) {
          const valText = $next.text().replace(/\s/g, "");
          const m = valText.match(/[¥￥]?\s?([\d,]+)\s*円?/);
          if (m) {
            const n = Number(m[1].replace(/,/g, ""));
            if (Number.isFinite(n) && n >= 0 && n < 100_000_000) {
              price = n;
              console.log("[jimoty-item] price via dt/th label match:", n);
            }
          }
        }
      }
      return undefined;
    });
  }

  // JSON-LD (構造化データ) から価格を取得
  if (price === undefined) {
    const jsonLdMatches = html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    );
    for (const ldMatch of jsonLdMatches) {
      try {
        const parsed = JSON.parse(ldMatch[1].trim());
        const found = findJsonLdPrice(parsed);
        if (found !== undefined) {
          price = found;
          console.log("[jimoty-item] price via JSON-LD:", found);
          break;
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  // 最後の保険: HTML 全体から ¥X,XXX または X,XXX円 を抽出
  if (price === undefined) {
    const m =
      html.match(/[¥￥]\s?([\d,]{2,9})(?!\d)/) ||
      html.match(/([\d,]{2,9})\s*円/);
    if (m) {
      const n = Number(m[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0 && n < 100_000_000) {
        price = n;
        console.log("[jimoty-item] price via fallback HTML regex:", n);
      }
    }
  }

  // 「あげます」「差し上げ」表記なら 0 円扱い (URL で giveaway 確定の時のみ)
  // URL から giveaway 判定 (sale カテゴリなら絶対 giveaway ではない)
  const isSaleUrl = /\/(sale|sell|s)-/.test(fullUrl) || fullUrl.includes("/sale/");
  const isGiveawayUrl = /\/(give|present|free|mu)-/.test(fullUrl);
  if (price === undefined && isGiveawayUrl && !isSaleUrl) {
    price = 0;
    console.log("[jimoty-item] price = 0 (giveaway URL)");
  }

  // 出品者: プロフィールページへのリンクを起点に探す
  // Jimoty のプロフィールページ URL パターン: /profiles/XXX (XXX は MongoDB ObjectId)
  let sellerName: string | undefined;
  let sellerUrl: string | undefined;
  let sellerRating: string | undefined;

  const $profileLink = $('a[href^="/profiles/"]')
    .filter((_, el) => {
      const href = $(el).attr("href") ?? "";
      // /profiles/{id}/evaluations や /profiles/{id}/posts などのサブページは除外
      // /profiles/{id} だけを対象に
      return /^\/profiles\/[a-f0-9]+(?:\?|$)/i.test(href);
    })
    .first();

  if ($profileLink.length) {
    const href = $profileLink.attr("href") ?? "";
    sellerUrl = href.startsWith("http") ? href : `https://jmty.jp${href}`;
    const linkText = $profileLink.text().trim();
    const imgAlt = $profileLink.find("img").attr("alt")?.trim();
    sellerName = linkText && linkText.length < 50 ? linkText : imgAlt;
    console.log(
      "[jimoty-item] seller link found:",
      sellerUrl,
      "name:",
      sellerName,
    );
  }

  // 診断: 全プロフィールリンクを 8 件まで列挙 (取れなかった場合に確認用)
  const profileProbe = $('a[href*="/profile"], a[href*="/users/"], a[href*="/user/"]')
    .map((_, el) => {
      const $el = $(el);
      return `${$el.attr("href")} | "${$el.text().trim().slice(0, 40)}"`;
    })
    .get()
    .slice(0, 8);
  console.log("[jimoty-item] profile link probe:", profileProbe);

  // 出品者の評価: profile リンクの近くから「評価」「件」「★」などを探す
  if ($profileLink.length) {
    // セラーのプロフィール URL から ID を取り出して、その ID の evaluations リンクから件数を取る
    const sellerIdMatch = sellerUrl?.match(/\/profiles\/([a-f0-9]+)/i);
    const sellerId = sellerIdMatch?.[1];

    // 「評価をもっと見る」リンク (= /profiles/{id}/evaluations) を起点に、
    // その近くの祖先要素を取って評価サマリーを探す
    // 「評価をもっと見る」リンクが起点。無ければ profileLink から祖先を遡る
    const $evalLink = $(
      `a[href^="/profiles/${sellerId ?? ""}/evaluations"]`,
    ).first();
    const $startNode = $evalLink.length ? $evalLink : $profileLink;
    let $sellerArea = $startNode;
    for (let i = 0; i < 6; i++) {
      const $next = $sellerArea.parent();
      if (!$next.length) break;
      $sellerArea = $next;
      // 評価関連テキストを含む十分大きい要素まで上昇
      const txt = $sellerArea.text();
      if (txt.length > 80 && /(良い|評価|本人確認)/.test(txt)) break;
    }
    const areaText = $sellerArea.text().replace(/\s+/g, " ").slice(0, 1500);

    // 診断: セラー周辺の HTML をログ出力 (要素構造を見る)
    console.log(
      "[jimoty-item] seller area HTML sample:",
      ($sellerArea.html() ?? "").slice(0, 1500),
    );
    console.log("[jimoty-item] seller area text:", areaText);

    // 1) 最優先: 「★ 5.0 (115)」のような平均評価＋件数表記
    //    記事ページの出品者欄に表示されているのでここから直接取れる
    const starMatch =
      areaText.match(/★\s*([\d.]+)\s*[(（]\s*([\d,]+)\s*[)）]/) ||
      areaText.match(/([\d]\.[\d])\s*[(（]\s*([\d,]+)\s*[)）]/);
    if (starMatch) {
      const stars = starMatch[1];
      const count = starMatch[2].replace(/,/g, "");
      sellerRating = `★ ${stars} (${count}件)`;
      console.log("[jimoty-item] seller rating via star+count:", sellerRating);
    }

    if (sellerId) {
      console.log("[jimoty-item] seller id:", sellerId);
    }

    // 記事ページに評価が無い場合、evaluations ページから取得
    // 実際の HTML 形式: "評価 ： 115" (合計件数) + <img src=".../evaluation_{good|normal|bad}_ico..."> アイコン
    if (!sellerRating && sellerId) {
      try {
        const evalUrl = `https://jmty.jp/profiles/${sellerId}/evaluations`;
        console.log("[jimoty-item] fetching evaluations page:", evalUrl);
        const evalRes = await fetch(evalUrl, {
          headers: {
            "User-Agent": USER_AGENT,
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
            Accept: "text/html,application/xhtml+xml",
          },
          cache: "no-store",
        });
        if (evalRes.ok) {
          const evalHtml = await evalRes.text();
          const $e = cheerio.load(evalHtml);

          // 1) 合計件数: "評価 ： 115" / "評価:115"
          const totalM = evalHtml.match(/評価\s*[：:]\s*(\d+)/);
          const total = totalM ? Number(totalM[1]) : null;

          // 2) アイコン src で評価種別をカウント (1 ページ分のみ)
          const goodN = $e('img[src*="evaluation_good_ico"]').length;
          const normalN = $e('img[src*="evaluation_normal_ico"]').length;
          const badN = $e('img[src*="evaluation_bad_ico"]').length;
          const onPage = goodN + normalN + badN;

          if (total !== null) {
            // 1 ページに全件収まっていれば内訳を出す
            if (onPage > 0 && total === onPage) {
              const parts: string[] = [];
              if (goodN) parts.push(`良い ${goodN}`);
              if (normalN) parts.push(`普通 ${normalN}`);
              if (badN) parts.push(`悪い ${badN}`);
              sellerRating = `評価 ${total}件 (${parts.join(" / ")})`;
            } else if (onPage > 0) {
              // ページネーションあり: 合計と「最近 N 件中」の内訳
              const parts: string[] = [];
              if (goodN) parts.push(`良い ${goodN}`);
              if (normalN) parts.push(`普通 ${normalN}`);
              if (badN) parts.push(`悪い ${badN}`);
              sellerRating = `評価 ${total}件 (直近 ${onPage}件: ${parts.join(" / ")})`;
            } else {
              sellerRating = `評価 ${total}件`;
            }
            console.log(
              "[jimoty-item] seller rating from evaluations page:",
              sellerRating,
            );
          } else if (onPage > 0) {
            const parts: string[] = [];
            if (goodN) parts.push(`良い ${goodN}`);
            if (normalN) parts.push(`普通 ${normalN}`);
            if (badN) parts.push(`悪い ${badN}`);
            sellerRating = parts.join(" / ");
            console.log(
              "[jimoty-item] seller rating via icon count only:",
              sellerRating,
            );
          } else {
            // 取れなかった場合の診断
            const evalIdx = evalHtml.search(/評価/);
            if (evalIdx > -1) {
              console.log(
                "[jimoty-item] evaluations '評価' context:",
                evalHtml
                  .slice(Math.max(0, evalIdx - 50), evalIdx + 250)
                  .replace(/\s+/g, " "),
              );
            }
          }
        }
      } catch (e) {
        console.warn("[jimoty-item] evaluations fetch failed:", e);
      }
    }
  }

  // 所在地
  let location: string | undefined;
  const PREF_RE = /(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/;
  const locationCandidates = [
    "[class*='location']",
    "[class*='Location']",
    "[class*='address']",
    "[class*='area']",
  ];
  for (const sel of locationCandidates) {
    const text = $(sel).first().text();
    const m = text.match(PREF_RE);
    if (m) {
      location = m[1];
      break;
    }
  }
  if (!location) {
    const bodyText = $("body").text();
    const m = bodyText.match(PREF_RE);
    if (m) location = m[1];
  }

  console.log("[jimoty-item] mapped:", {
    hasDescription: !!description,
    descLen: description?.length ?? 0,
    imageCount: images.length,
    price,
    sellerName,
    sellerUrl,
    sellerRating,
    location,
  });

  return {
    id,
    description,
    images: images.length > 0 ? images : undefined,
    price,
    sellerName,
    sellerUrl,
    sellerRating,
    location,
  };
}
