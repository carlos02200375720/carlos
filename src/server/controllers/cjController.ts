import { Request, Response } from "express";

/**
 * GET /api/cj/freight-options
 * CJ Dropshipping Freight Options API Route (Calculate shipping to any country)
 */
export async function getFreightOptions(req: Request, res: Response): Promise<void> {
  try {
    const vidQuery = ((req.query.vid as string) || (req.query.pid as string) || (req.query.sku as string) || "").trim();
    const pidQuery = ((req.query.pid as string) || "").trim();
    const destCountry = ((req.query.destCountry as string) || "US").trim().toUpperCase();
    const startCountry = ((req.query.startCountry as string) || "CN").trim().toUpperCase();

    if (!vidQuery && !pidQuery) {
      res.status(400).json({ error: "Se requiere un ID de variante (vid), PID o SKU de CJ." });
      return;
    }

    let cjToken = process.env.CJ_ACCESS_TOKEN || "CJ3709637@api@1ecd84b9afb74c7d86227fe82c563898";

    // Helper to execute CJ freight API
    const callFreightApi = async (token: string, targetVid: string) => {
      try {
        const res1 = await fetch("https://developers.cjdropshipping.com/api2.0/v1/logistic/freightCalculate", {
          method: "POST",
          headers: {
            "CJ-Access-Token": token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startCountryCode: startCountry,
            endCountryCode: destCountry,
            products: [{ quantity: 1, vid: targetVid }],
          }),
        });
        const data1 = await res1.json();
        if (data1.result && Array.isArray(data1.data) && data1.data.length > 0) {
          return data1.data;
        }

        const res2 = await fetch("https://developers.cjdropshipping.com/api2.0/v1/logistic/freightCalculate", {
          method: "POST",
          headers: {
            "CJ-Access-Token": token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startCountryCode: "CN",
            endCountryCode: destCountry,
            variantId: targetVid,
            quantity: 1,
          }),
        });
        const data2 = await res2.json();
        if (data2.result && Array.isArray(data2.data) && data2.data.length > 0) {
          return data2.data;
        }
      } catch (e) {
        console.warn("Error calling freightCalculate:", e);
      }
      return null;
    };

    let targetVid = vidQuery;
    if (!targetVid || targetVid.length < 5) {
      try {
        const prodRes = await fetch(
          `https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(pidQuery || vidQuery)}`,
          {
            headers: { "CJ-Access-Token": cjToken },
          }
        );
        const prodData = await prodRes.json();
        if (prodData.result && prodData.data) {
          targetVid = prodData.data.variants?.[0]?.vid || prodData.data.pid || vidQuery;
        }
      } catch (e) {}
    }

    let freightDataList = await callFreightApi(cjToken, targetVid);

    if (!freightDataList) {
      const possibleKeys = [
        cjToken,
        cjToken.includes("@api@") ? cjToken.split("@api@")[1] : cjToken,
        "1ecd84b9afb74c7d86227fe82c563898",
      ];
      for (const key of possibleKeys) {
        try {
          const authRes = await fetch(
            "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ apiKey: key }),
            }
          );
          const authData = await authRes.json();
          if (authData.result && authData.data?.accessToken) {
            cjToken = authData.data.accessToken;
            freightDataList = await callFreightApi(cjToken, targetVid);
            if (freightDataList) break;
          }
        } catch (e) {}
      }
    }

    if (freightDataList && Array.isArray(freightDataList) && freightDataList.length > 0) {
      const options = freightDataList.map((opt: any) => {
        const carrier = opt.logisticName || opt.option?.enName || opt.name || "CJPacket";
        const cost =
          typeof opt.logisticPrice === "number"
            ? opt.logisticPrice
            : parseFloat(opt.postage || opt.logisticPrice || opt.price || "3.50");
        const aging = opt.logisticAging
          ? `${opt.logisticAging} días`
          : opt.arrivalTime
          ? `${opt.arrivalTime} días`
          : "7-15 días";

        return {
          carrier,
          shippingCost: cost > 0 ? Number(cost.toFixed(2)) : 3.5,
          aging,
          startCountry: `Almacén China (${startCountry})`,
          destCountry,
        };
      });

      options.sort((a: any, b: any) => a.shippingCost - b.shippingCost);

      console.log(
        `✈️ CJ Freight calculated for ${destCountry}: ${options.length} real options found (Cheapest: $${options[0].shippingCost})`
      );
      res.json({ success: true, options });
      return;
    }

    res.status(404).json({
      error: `No se encontraron tarifas de envío en CJ Dropshipping para el destino ${destCountry}.`,
      destCountry,
    });
  } catch (err: any) {
    console.error("Error calculating CJ freight options:", err);
    res.status(500).json({ error: err.message || "Error al calcular flete de CJ" });
  }
}

/**
 * GET /api/cj/import-product
 * CJ Dropshipping Product Import API Proxy
 */
export async function importProduct(req: Request, res: Response): Promise<void> {
  try {
    const { pid, sku, destCountry } = req.query;
    const searchId = ((pid || sku || "") as string).trim();
    const targetCountry = ((destCountry as string) || "US").trim().toUpperCase();

    if (!searchId) {
      res.status(400).json({ error: "Se requiere un ID de producto o SKU de CJ Dropshipping." });
      return;
    }

    let cjToken = process.env.CJ_ACCESS_TOKEN || "CJ3709637@api@1ecd84b9afb74c7d86227fe82c563898";

    const attemptCjFetch = async (token: string) => {
      const headers = { "CJ-Access-Token": token };

      let res = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(searchId)}`, { headers });
      let data = await res.json();
      if (data.result && data.data) return data;

      res = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?productSku=${encodeURIComponent(searchId)}`, { headers });
      data = await res.json();
      if (data.result && data.data) return data;

      res = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?variantSku=${encodeURIComponent(searchId)}`, { headers });
      data = await res.json();
      if (data.result && data.data) return data;

      res = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/list?pid=${encodeURIComponent(searchId)}`, { headers });
      let listData = await res.json();
      if (listData.result && listData.data && listData.data.list && listData.data.list.length > 0) {
        const firstPid = listData.data.list[0].pid;
        if (firstPid) {
          res = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(firstPid)}`, { headers });
          data = await res.json();
          if (data.result && data.data) return data;
        }
      }

      res = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/listV2?keyWord=${encodeURIComponent(searchId)}&page=1&size=5`, { headers });
      let v2Data = await res.json();
      if (v2Data.result && v2Data.data && v2Data.data.content && v2Data.data.content.length > 0) {
        const contentItem = v2Data.data.content[0];
        const prodItem = contentItem.productList?.[0];
        if (prodItem && prodItem.id) {
          res = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(prodItem.id)}`, { headers });
          data = await res.json();
          if (data.result && data.data) return data;
        }
      }

      return data;
    };

    let cjData = await attemptCjFetch(cjToken);

    if (!cjData.result || cjData.code === 1600100 || (cjData.message && cjData.message.includes("token"))) {
      const possibleKeys = [
        cjToken,
        cjToken.includes("@api@") ? cjToken.split("@api@")[1] : cjToken,
        "1ecd84b9afb74c7d86227fe82c563898",
      ];

      for (const apiKeyCandidate of possibleKeys) {
        try {
          const authRes = await fetch("https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey: apiKeyCandidate }),
          });
          const authData = await authRes.json();
          if (authData.result && authData.data && authData.data.accessToken) {
            cjToken = authData.data.accessToken;
            cjData = await attemptCjFetch(cjToken);
            if (cjData.result && cjData.data) break;
          }
        } catch (e) {}
      }
    }

    if (cjData.result && cjData.data) {
      const prod = cjData.data;

      let name = prod.productNameEn || prod.productName || "Producto CJ";
      if (typeof name === "string" && name.startsWith("[")) {
        try {
          const parsed = JSON.parse(name);
          if (Array.isArray(parsed) && parsed.length > 0) {
            name = parsed.filter(Boolean).pop() || parsed[0];
          }
        } catch (e) {}
      }

      let description = (prod.description || "").replace(/<[^>]*>?/gm, "").trim();
      if (!description) description = name;

      const imagesSet: string[] = [];
      if (prod.bigImage) imagesSet.push(prod.bigImage);
      if (Array.isArray(prod.productImageSet)) {
        prod.productImageSet.forEach((img: string) => {
          if (img && !imagesSet.includes(img)) {
            imagesSet.push(img);
          }
        });
      }

      const rawVariants = prod.variants || [];
      const variantMap: Record<string, Set<string>> = {};
      const variantList: any[] = [];

      rawVariants.forEach((v: any) => {
        const vImg =
          v.variantImage ||
          v.variantImg ||
          (Array.isArray(v.variantImageSet)
            ? v.variantImageSet[0]
            : typeof v.variantImageSet === "string"
            ? v.variantImageSet
            : "") ||
          "";

        if (vImg && typeof vImg === "string" && !imagesSet.includes(vImg)) {
          imagesSet.push(vImg);
        }

        let colorName = "";
        let sizeName = "";

        if (v.variantKey) {
          const parts = v.variantKey.split("-");
          if (parts.length === 2) {
            colorName = parts[0].trim();
            sizeName = parts[1].trim();
            if (!variantMap["Color"]) variantMap["Color"] = new Set();
            if (!variantMap["Talla"]) variantMap["Talla"] = new Set();
            variantMap["Color"].add(colorName);
            variantMap["Talla"].add(sizeName);
          } else {
            colorName = v.variantKey.trim();
            if (!variantMap["Opción"]) variantMap["Opción"] = new Set();
            variantMap["Opción"].add(colorName);
          }
        } else if (v.variantNameEn) {
          colorName = v.variantNameEn.trim();
          if (!variantMap["Estilo"]) variantMap["Estilo"] = new Set();
          variantMap["Estilo"].add(colorName);
        }

        variantList.push({
          vid: v.vid || "",
          name: v.variantNameEn || v.variantKey || v.variantName || colorName || "Variante",
          color: colorName || undefined,
          size: sizeName || undefined,
          price: parseFloat(v.variantSellPrice || v.variantPrice || prod.sellPrice || 12.99),
          imageUrl: vImg || undefined,
          sku: v.variantSku || undefined,
        });
      });

      const parsedVariants = Object.keys(variantMap).map((key) => ({
        name: key,
        options: Array.from(variantMap[key]),
      }));

      let totalStock = 50;
      if (rawVariants.length > 0) {
        const variantWithStock = rawVariants.find((v: any) => v.inventories && v.inventories.length > 0);
        if (variantWithStock) {
          totalStock =
            variantWithStock.inventories.reduce((sum: number, inv: any) => sum + (inv.totalInventory || 0), 0) || 50;
        }
      }

      let category = "Electrónica";
      const catName = (prod.categoryName || "").toLowerCase();
      if (catName.includes("women") || catName.includes("clothing") || catName.includes("ropa")) {
        category = "Ropa Femenina";
      } else if (catName.includes("men")) {
        category = "Ropa Masculina";
      } else if (catName.includes("home") || catName.includes("garden") || catName.includes("hogar")) {
        category = "Hogar";
      } else if (catName.includes("pet") || catName.includes("mascota")) {
        category = "Mascotas";
      } else if (catName.includes("jewelry") || catName.includes("joya")) {
        category = "Joyas";
      } else if (catName.includes("toy") || catName.includes("juguete")) {
        category = "Juguetes";
      } else if (catName.includes("sport") || catName.includes("deporte")) {
        category = "Deportes";
      } else if (catName.includes("shoe") || catName.includes("zapato")) {
        category = "Zapatos";
      } else if (catName.includes("bag") || catName.includes("bolso")) {
        category = "Bolsos";
      }

      const firstVid = rawVariants[0]?.vid || prod.pid;
      let shippingOptions: any[] = [];

      try {
        const freightRes = await fetch("https://developers.cjdropshipping.com/api2.0/v1/logistic/freightCalculate", {
          method: "POST",
          headers: {
            "CJ-Access-Token": cjToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startCountryCode: "CN",
            endCountryCode: targetCountry,
            products: [{ quantity: 1, vid: firstVid }],
          }),
        });
        const freightData = await freightRes.json();
        if (freightData.result && Array.isArray(freightData.data) && freightData.data.length > 0) {
          shippingOptions = freightData.data.map((opt: any) => ({
            carrier: opt.logisticName || opt.option?.enName || "CJPacket",
            shippingCost: typeof opt.logisticPrice === "number" ? opt.logisticPrice : parseFloat(opt.postage || opt.logisticPrice || "3.50"),
            aging: opt.logisticAging ? `${opt.logisticAging} días` : opt.arrivalTime ? `${opt.arrivalTime} días` : "7-15 días",
            startCountry: "Almacén China (CN)",
            destCountry: targetCountry,
          }));
        }
      } catch (fErr) {
        console.warn("Logistics calculate fallback:", fErr);
      }

      if (shippingOptions.length === 0) {
        shippingOptions = [
          { carrier: "CJPacket Ordinary", shippingCost: 3.5, aging: "8-15 días", startCountry: "Almacén China (CN)", destCountry: targetCountry },
          { carrier: "CJPacket Sensitive", shippingCost: 4.2, aging: "7-12 días", startCountry: "Almacén China (CN)", destCountry: targetCountry },
          { carrier: "USPS+", shippingCost: 5.1, aging: "5-10 días", startCountry: "Almacén China (CN)", destCountry: targetCountry },
          { carrier: "DHL Express", shippingCost: 18.5, aging: "3-5 días", startCountry: "Almacén China (CN)", destCountry: targetCountry },
        ];
      }

      const primaryLogistics = {
        variantId: firstVid,
        destCountry: targetCountry,
        carrier: shippingOptions[0].carrier,
        shippingCost: shippingOptions[0].shippingCost,
        aging: shippingOptions[0].aging,
        startCountry: shippingOptions[0].startCountry,
        shippingOptions,
      };

      res.json({
        success: true,
        product: {
          cjProductId: prod.pid || searchId,
          cjVariantId: firstVid,
          name,
          description,
          price: parseFloat(prod.sellPrice || rawVariants[0]?.variantSellPrice || 12.99),
          stock: totalStock,
          category,
          images: imagesSet,
          variants: parsedVariants,
          variantList,
          logistics: primaryLogistics,
        },
      });
      return;
    }

    const errorMsg =
      cjData.message ||
      "No se encontró ningún producto en CJ Dropshipping con ese ID o SKU. Verifica el ID o que el token de la API de CJ sea válido.";
    res.status(400).json({ error: errorMsg });
  } catch (err: any) {
    console.error("❌ Error in /api/cj/import-product:", err);
    res.status(500).json({ error: err.message || "Error al importar datos de CJ Dropshipping" });
  }
}
