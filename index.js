const express = require('express');
const body_parser = require('body-parser');
const axios = require('axios');
const app = express().use(body_parser.json());

const token = process.env.WHATSAPP_TOKEN;
const phone_id = process.env.WHATSAPP_PHONE_ID;
const openai_key = process.env.OPENAI_API_KEY;

// Mémoire des conversations (en attendant une base de données)
let conversations = {};

app.get('/', (req,res)=>{ res.send('SECOND BRICE LIVE 🔥'); });

app.get('/webhook', (req,res)=>{
  if(req.query['hub.verify_token'] === process.env.VERIFY_TOKEN){
    res.send(req.query['hub.challenge']);
  } else { res.sendStatus(403); }
});

app.post('/webhook', async (req,res)=>{
  try {
    let msgObj = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if(!msgObj) return res.sendStatus(200);

    let phone = msgObj.from;
    let msg = msgObj.text?.body || "";

    // Si c'est toi qui a répondu manuellement récemment, on pause le bot 2h
    if(conversations[phone]?.pauseUntil > Date.now()) {
      return res.sendStatus(200);
    }

    // Historique pour ce client
    if(!conversations[phone]) conversations[phone] = { history: [], pauseUntil: 0 };
    conversations[phone].history.push({role: "user", content: msg});
    // On garde les 10 derniers messages
    if(conversations[phone].history.length > 10) conversations[phone].history.shift();

    // PERSONNALITÉ DE BRICE - SECOND MOI
    let systemPrompt = `
Tu es Brice, le second moi. Tu es le patron de KANG-LA.
Ta personnalité: Cool, taquin, dragueur, un peu charmeur, très Abidjanais. Tu dis "mon coeur", "ma belle", "mon frère", "boss", "t'es grave".
Tu ne parles JAMAIS comme un robot. Tu parles comme un gars de 25 ans qui a la tchatche.

Ton business KANG-LA:
- Chaussures: Air Max 95, Jordan 4, New Balance 550, Yeezy Slide
- Prix: 25.000 FCFA
- Pointures 40-45
- Livraison Abidjan 1500/2000F

Tes règles:
1. Réponds court, 2-3 lignes max. Pas de pavé.
2. Sois taquin et dragueur si c'est une fille, cool et fraternel si c'est un gars.
3. Si on te demande un produit, donne le prix avec un petit charme.
4. Si tu ne sais pas, dis: "Attends bb je demande à mon grand moi et je te reviens"
5. Ne dis JAMAIS que tu es une IA. Tu es Brice.
6. Adapte toi: si le client est pressé, va droit au but pour la commande.
`;

    let aiReply = "";

    if(openai_key){
      // VERSION AVEC IA (vraiment toi)
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4o-mini",
        messages: [
          {role: "system", content: systemPrompt},
         ...conversations[phone].history
        ],
        max_tokens: 150,
        temperature: 0.9
      }, { headers: { Authorization: `Bearer ${openai_key}` }});

      aiReply = response.data.choices[0].message.content;
    } else {
      // VERSION SANS CLÉ - Style Brice direct
      let lower = msg.toLowerCase();
      if(lower.includes("bonjour") || lower.includes("salut") || lower.includes("cc")){
        aiReply = "Salut toi 😏 c'est Brice de KANG-LA. Tu m'as manqué hein, tu veux quoi aujourd'hui mon coeur?";
      } else if(lower.includes("prix") || lower.includes("combien")){
        aiReply = "25k seulement ma belle/mon frère 😎 et je te livre même aujourd'hui à Abidjan. Tu fais quelle pointure?";
      } else if(lower.includes("jordan") || lower.includes("air max") || lower.includes("new balance")){
        aiReply = "Ouf t'as du goût hein 😏 celui-là il est dangereux, tout le monde va te demander c'est où tu as eu ça. Tu veux en quelle pointure?";
      } else {
        aiReply = "Hmm j'ai capté 😏 Dis-moi tout, tu veux commander ou tu es venue me draguer un peu?";
      }
    }

    conversations[phone].history.push({role: "assistant", content: aiReply});

    // Envoi sur WhatsApp
    await axios.post(`https://graph.facebook.com/v21.0/${phone_id}/messages?access_token=${token}`, {
      messaging_product: "whatsapp",
      to: phone,
      text: { body: aiReply }
    });

    console.log(`[${phone}]: ${msg} -> ${aiReply}`);
    res.sendStatus(200);

  } catch(e){ console.log(e.response?.data || e.message); res.sendStatus(200); }
});

app.listen(process.env.PORT || 10000, ()=>{ console.log("SECOND BRICE lancé"); });
