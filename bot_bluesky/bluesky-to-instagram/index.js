require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { combineImages } = require('./convertImg');

const BLUESKY_API_KEY = process.env.BLUESKY_API_KEY;
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

async function fetchBlueskyPosts() {
    try {
        const response = await axios.get('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed', {
            headers: {
                'Authorization': `Bearer ${BLUESKY_API_KEY}`,
            },
            params: {
                actor: 'poptime.space',
                limit: 1
            },
        });

        const posts = response.data.feed;
        // Processar os dados conforme necessário
        return posts;
    } catch (error) {
        console.error('Erro ao buscar postagens do Bluesky:', error);
        return [];
    }
}

async function postToInstagram(imageUrl, caption) {
    try {
        // Etapa 1: Criar um contêiner de mídia
        const mediaObjectResponse = await axios.post(
            `https://graph.facebook.com/v17.0/17841401063551163/media`,
            {
                image_url: imageUrl,
                caption: caption,
                access_token: INSTAGRAM_ACCESS_TOKEN,
            }
        );

        // Etapa 2: Publicar o contêiner de mídia
        const creationId = mediaObjectResponse.data.id;

        const publishResponse = await axios.post(
            `https://graph.facebook.com/v17.0/17841401063551163/media_publish`,
            {
                creation_id: creationId,
                access_token: INSTAGRAM_ACCESS_TOKEN,
            }
        );

        console.log('Post publicado no Instagram:', publishResponse.data);
    } catch (error) {
        console.error('Erro ao postar no Instagram:', error.response ? error.response.data : error);
    }
}

function getPostedPostIds() {
    if (!fs.existsSync('postedPosts.json')) {
        fs.writeFileSync('postedPosts.json', JSON.stringify([]));
    }
    const data = fs.readFileSync('postedPosts.json');
    return JSON.parse(data);
}

function savePostedPostIds(postIds) {
    fs.writeFileSync('postedPosts.json', JSON.stringify(postIds));
}

async function main() {
    // Obter IDs de postagens já publicadas
    const postedPostIds = getPostedPostIds();

    // Buscar postagens do Bluesky
    const posts = await fetchBlueskyPosts();
    
    // Filtrar novas postagens
    const newPosts = posts.filter(post => !postedPostIds.includes(post.cid));
    let novaImagem;

    // Postar novas postagens no Instagram
    for (const data of newPosts) {

        const text = data.post.record.text;
        const images = data.post.embed.images;
        const id = data.post.cid;

        if (images.length > 1) {

            // Extrair URLs das imagens
            const imageUrls = images.map(image => image.fullsize);
            
            // Combinar todas as imagens
            combineImages(...imageUrls);
            novaImagem = 'combined-image.png';
        } else {
            // Usar a única imagem disponível
           novaImagem = images[0].fullsize;
        }


        await postToInstagram(novaImagem, text);
        // Adicionar o ID da postagem à lista de postagens publicadas
        postedPostIds.push(id);
        // Salvar a lista atualizada
        savePostedPostIds(postedPostIds);
    }

    if (newPosts.length === 0) {
        console.log('Nenhuma nova postagem para publicar.');
    }
}

main();