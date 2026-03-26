export default async function handler(req, res) {
  // CORS headers - must be set before anything else
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SHOPIFY_DOMAIN = 'mtkwni-yf.myshopify.com';
  const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!ACCESS_TOKEN) {
    return res.status(500).json({ success: false, error: 'Missing access token' });
  }

  try {
    const formData = req.body;

    const draftOrderData = {
      draft_order: {
        line_items: [{
          title: `Commande Noor Parfums - ${formData.packs.length} packs`,
          price: formData.total.toString(),
          quantity: 1,
          requires_shipping: true,
          taxable: false,
          properties: [
            { name: 'Nombre de packs', value: formData.packs.length.toString() },
            { name: 'Détails', value: formData.note }
          ]
        }],
        customer: {
          first_name: formData.customer.fullName.split(' ')[0],
          last_name: formData.customer.fullName.split(' ').slice(1).join(' ') || '-',
          phone: formData.customer.phone
        },
        shipping_address: {
          first_name: formData.customer.fullName.split(' ')[0],
          last_name: formData.customer.fullName.split(' ').slice(1).join(' ') || '-',
          address1: formData.customer.address,
          city: formData.customer.city,
          country: 'MA',
          phone: formData.customer.phone
        },
        note: formData.orderNote,
        tags: 'noor-parfums,custom-order',
        tax_exempt: true
      }
    };

    // Step 1: Create draft order
    const draftRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/draft_orders.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ACCESS_TOKEN
      },
      body: JSON.stringify(draftOrderData)
    });

    const draftText = await draftRes.text();

    if (!draftRes.ok) {
      throw new Error(`Draft failed: ${draftRes.status} - ${draftText}`);
    }

    const draft = JSON.parse(draftText);

    // Step 2: Complete the draft order
    const completeRes = await fetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/draft_orders/${draft.draft_order.id}/complete.json`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': ACCESS_TOKEN
        },
        body: JSON.stringify({ payment_pending: true })
      }
    );

    const completeText = await completeRes.text();

    if (!completeRes.ok) {
      throw new Error(`Complete failed: ${completeRes.status} - ${completeText}`);
    }

    const completed = JSON.parse(completeText);

    return res.status(200).json({
      success: true,
      orderId: completed.draft_order.id,
      orderNumber: completed.draft_order.name
    });

  } catch (error) {
    console.error('Order error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
