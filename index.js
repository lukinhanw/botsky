// Load environment variables from .env file
require('dotenv').config();

// Import necessary modules
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

// Retrieve API keys and tokens from environment variables
const BLUESKY_API_KEY = process.env.BLUESKY_API_KEY;
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const USER_ID_IG = process.env.USER_ID_IG;

// Function to fetch posts from Bluesky API
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
        return posts; // Retornar os posts
    } catch (error) {
        console.error('Erro ao buscar postagens do Bluesky:', error);
        return [];
    }
}

// Function to upload image to imgbb
async function uploadImageToImgbb(imageUrl) {
    const imgbbApiKey = process.env.IMGBB_API_KEY;

    try {
        // Baixar a imagem como um buffer
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'binary');

        const form = new FormData();
        form.append('image', imageBuffer.toString('base64'));

        const uploadResponse = await axios.post(
            `https://api.imgbb.com/1/upload?key=${imgbbApiKey}`,
            form,
            { headers: form.getHeaders() }
        );

        return uploadResponse.data.data.url; // Retorna a URL da imagem carregada
    } catch (error) {
        console.error('Erro ao fazer upload da imagem para o imgbb:', error.response ? error.response.data : error);
        return null;
    }
}

// Function to upload individual media to Instagram and return media ID
async function uploadImageToInstagram(imageUrl) {
    try {
        const mediaObjectResponse = await axios.post(
            `https://graph.facebook.com/v20.0/${USER_ID_IG}/media`,
            {
                image_url: imageUrl,
                access_token: INSTAGRAM_ACCESS_TOKEN,
            }
        );
        return mediaObjectResponse.data.id; // Retorna o ID da mídia criada
    } catch (error) {
        console.error('Erro ao fazer upload da imagem para o Instagram:', error.response ? error.response.data : error);
        return null;
    }
}

// Function to create a carousel post on Instagram
async function postCarouselToInstagram(mediaIds, caption) {
    try {
        const carouselContainerResponse = await axios.post(
            `https://graph.facebook.com/v20.0/${USER_ID_IG}/media`,
            {
                media_type: 'CAROUSEL',
                children: mediaIds, // Passar o array de IDs das mídias
                access_token: INSTAGRAM_ACCESS_TOKEN,
                caption: caption
            }
        );

        const creationId = carouselContainerResponse.data.id;

        const publishResponse = await axios.post(
            `https://graph.facebook.com/v20.0/${USER_ID_IG}/media_publish`,
            {
                creation_id: creationId, // Usar o creation_id retornado pelo contêiner de mídia
                access_token: INSTAGRAM_ACCESS_TOKEN
            }
        );

        console.log('Carrossel publicado no Instagram:', publishResponse.data);
    } catch (error) {
        console.error('Erro ao publicar carrossel no Instagram:', error.response ? error.response.data : error);
    }
}

// Function to get the IDs of posts that have already been posted
function getPostedPostIds() {
    if (!fs.existsSync('postedPosts.json')) {
        fs.writeFileSync('postedPosts.json', JSON.stringify([]));
    }
    const data = fs.readFileSync('postedPosts.json');
    return JSON.parse(data);
}

// Function to save the IDs of posts that have been posted
function savePostedPostIds(postIds) {
    fs.writeFileSync('postedPosts.json', JSON.stringify(postIds));
}

// Main function to orchestrate the fetching and posting of images
async function main() {
    // Obter IDs de postagens já publicadas
    const postedPostIds = getPostedPostIds();

    // Buscar postagens do Bluesky
    const posts = await fetchBlueskyPosts();

    // Filtrar novas postagens que ainda não foram postadas
    const newPosts = posts.filter(post => !postedPostIds.includes(post.cid));

    // Postar novas postagens no Instagram
    for (const data of newPosts) {
        const text = data.post.record.text;
        const images = data.post.embed.images;
        const id = data.post.cid;

        if (postedPostIds.includes(id)) {
            console.log(`Post com ID ${id} já foi publicado. Ignorando...`);
            continue; // Ignorar este post
        }

        if (images.length >= 1) {
            const mediaIds = [];

            for (const image of images) {
                const imageUrl = await uploadImageToImgbb(image.fullsize); // Upload para imgbb
                if (imageUrl) {
                    const mediaId = await uploadImageToInstagram(imageUrl); // Fazer upload no Instagram
                    if (mediaId) {
                        mediaIds.push(mediaId); // Adicionar o ID da mídia ao array
                    }
                }
            }

            // Se houver IDs de mídia, criar o post de carrossel
            if (mediaIds.length > 0) {
                await postCarouselToInstagram(mediaIds, text);
                // Adicionar o ID da postagem à lista de postagens publicadas
                postedPostIds.push(id);
                savePostedPostIds(postedPostIds); // Salvar a lista atualizada
            }
        }
    }

    if (newPosts.length === 0) {
        console.log('Nenhuma nova postagem para publicar.');
    }
}

// Execute the main function
main();
