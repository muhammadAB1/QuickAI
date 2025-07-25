import OpenAI from 'openai';
import sql from '../configs/db.js';
import { clerkClient } from '@clerk/express';
import axios from 'axios'
import { getObject, putObject } from '../configs/awsS3.js';
import cloudinary from 'cloudinary'
import fsPromises from 'fs/promises';
import pdf from 'pdf-parse/lib/pdf-parse.js'

const AI = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
})

export const generateArticle = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { prompt, length } = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        if (plan !== 'premium' && free_usage >= 10) {
            return res.json({
                success: false,
                message: 'Limit reached. Upgrade to continue.'
            })
        }

        const response = await AI.chat.completions.create({
            model: "deepseek/deepseek-chat-v3-0324:free",
            messages: [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature: 0.7,
            max_tokens: length,

        });

        const content = response.choices[0].message.content;

        await sql`INSERT into creations (user_id, prompt, content, type)
        values (${userId}, ${prompt}, ${content}, 'article')`

        if (plan !== 'premium') {
            await clerkClient.users.updateUserMetadata(userId, {
                free_usage: free_usage + 1
            })
        }

        res.json({
            success: true,
            content
        })

    } catch (error) {
        console.log(error.message)
        res.json({
            success: false,
            message: error.message
        })
    }
}

export const generateBlogTitle = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { prompt } = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage

        if (plan !== 'premium' && free_usage >= 10) {
            return res.json({
                success: false,
                message: 'Limit reached. Upgrade to continue.'
            })
        }

        const response = await AI.chat.completions.create({
            model: "deepseek/deepseek-chat-v3-0324:free",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 100,

        });

        const content = response.choices[0].message.content;

        await sql`INSERT into creations (user_id, prompt, content, type)
        values (${userId}, ${prompt}, ${content}, 'blog-title')`

        if (plan !== 'premium') {
            await clerkClient.users.updateUserMetadata(userId, {
                free_usage: free_usage + 1
            })
        }

        res.json({
            success: true,
            content
        })

    } catch (error) {
        console.log(error.message)
        res.json({
            success: false,
            message: error.message
        })
    }
}

export const generateImage = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { prompt, publish } = req.body;
        const plan = req.plan;

        if (plan !== 'premium') {
            return res.json({
                success: false,
                message: 'This feature is only available for premium subscriptions'
            })
        }

        // const formData = new FormData()
        // form.append('prompt', prompt)
        // const { data } = await axios.post('https://clipdrop-api.co/text-to-image/v1', formData, {
        // headers: {
        // 'x-api-key': process.env.CLIPDROP_API_KEY,
        // },
        // responseType: 'arraybuffer'
        // })
        const width = 1024;
        const height = 1024;
        const seed = 42;
        const model = 'flux'
        const data = `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&model=${model}`;

        const response = await fetch(data);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const date = Date.now();

        // const base64Image = `data:image/png;base64,${Buffer.from(data, 'binary').toString('base64')}`

        const link = await putObject(buffer, `${date}.png`, 'image/png')


        const image = await getObject(`quickAI/${link}`)


        // const date = Date.now();
        // const link = await putObject(`image-${date}.png`, 'image/png', date)
        // fetch(link, {
        //     method: 'PUT',
        //     body: base64Image
        // })

        await sql`INSERT into creations (user_id, prompt, content, type, publish)
        values (${userId}, ${prompt}, ${link}, 'image', ${publish ?? false})`

        res.json({
            success: true,
            content: image
        })

    } catch (error) {
        console.log(error.message)
        res.json({
            success: false,
            message: error.message
        })
    }
}

export const removeImageBackground = async (req, res) => {
    try {
        const { userId } = req.auth();
        const image = req.file;
        const plan = req.plan;

        if (plan !== 'premium') {
            return res.json({
                success: false,
                message: 'This feature is only available for premium subscriptions'
            })
        }

        const { secure_url } = await cloudinary.v2.uploader.upload(image.path, {
            transformation: [
                {
                    effect: 'background_removal',
                }
            ]
        })
        await fsPromises.unlink(image.path);

        await sql`INSERT into creations (user_id, prompt, content, type)
        values (${userId}, 'Remove background from image', ${secure_url}, 'image')`

        res.json({
            success: true,
            content: secure_url
        })

    } catch (error) {
        console.log(error.message)
        res.json({
            success: false,
            message: error.message
        })
    }
}

export const removeImageObject = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { object } = req.body;
        const image = req.file
        const plan = req.plan;

        if (plan !== 'premium') {
            return res.json({
                success: false,
                message: 'This feature is only available for premium subscriptions'
            })
        }

        const { public_id } = await cloudinary.v2.uploader.upload(image.path)


        const imageUrl = cloudinary.url(public_id, {
            transformation: [{
                effect: `gen_remove:${object}`
            }],
            resource_type: 'image'
        }
        )

        await fsPromises.unlink(image.path);

        await sql`INSERT into creations (user_id, prompt, content, type)
        values (${userId}, ${`removed ${object} from image`}, ${imageUrl}, 'image')`

        res.json({
            success: true,
            content: imageUrl
        })

    } catch (error) {
        console.log(error.message)
        res.json({
            success: false,
            message: error.message
        })
    }
}

export const resumeReview = async (req, res) => {
    try {
        const { userId } = req.auth();
        const resume = req.file
        const plan = req.plan;

        if (plan !== 'premium') {
            return res.json({
                success: false,
                message: 'This feature is only available for premium subscriptions'
            })
        }

        if (resume.size > 5 * 1024 * 1025)
            return res.json({
                success: false,
                message: 'Resume file size exceeds allowed size (5MB).'
            })

        const dataBuffer = fs.readFileSync(resume.path)
        const pdfData = await pdf(dataBuffer)

        fs.unlinkSync(resume.path);

        const prompt = `Review the following resume and provide constructive feedback on its strengths, weakness, and areas for improvement.
        Resume Content:\n\n${pdfData.text}`

        const response = await AI.chat.completions.create({
            model: "deepseek/deepseek-chat-v3-0324:free",
            messages: [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 1000,

        });

        const content = response.choices[0].message.content;

        await sql`INSERT into creations (user_id, prompt, content, type)
        values (${userId}, 'Review the uploaded resume', ${content}, 'resume-review')`

        res.json({
            success: true,
            content: content
        })

    } catch (error) {
        console.log(error.message)
        res.json({
            success: false,
            message: error.message
        })
    }
}