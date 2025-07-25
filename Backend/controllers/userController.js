import { getObject } from "../configs/awsS3.js";
import sql from "../configs/db.js";


export const getUserCreation = async (req, res) => {
    try {
        const { userId } = req.auth();

        const creations = await sql`SELECT * FROM creations WHERE user_id = ${userId} ORDER BY created_at DESC`;
        for (let index = 0; index < creations.length; index++) {
            if (creations[index].prompt.split(' ')[0] == 'Generate' && creations[index].type == 'image')
                creations[index].content = await getObject(`quickAI/${creations[index].content}`);
        }
        console.log(creations[0].type)
        res.json({ success: true, creations });

    } catch (error) {
        res.json({ success: false, message: error })
    }
}

export const getPublishedCreations = async (req, res) => {
    try {
        const creations = await sql`SELECT * FROM creations WHERE publish = true ORDER BY created_at DESC`;
        for (let index = 0; index < creations.length; index++) {
            creations[index].content = await getObject(`quickAI/${creations[index].content}`);
        }
        res.json({ success: true, creations });

    } catch (error) {
        res.json({ success: false, message: error })
    }
}

export const toggleLikeCreation = async (req, res) => {
    try {

        const { userId } = req.auth();
        const { id } = req.body;

        const [creation] = await sql`SELECT * FROM creations WHERE id = ${id}`;

        if (!creation) {
            return res.json({ success: false, message: "Creation not found" })
        }

        const currentLikes = creation.likes;

        const userIdStr = userId.toString();

        let updatedLikes;
        let message;

        if (currentLikes.includes(userIdStr)) {
            updatedLikes = currentLikes.filter((user) => user !== userIdStr);
            message = 'Creation Unliked'
        }

        else {
            updatedLikes = [...currentLikes, userIdStr];
            message = 'Creation Liked'
        }

        const formattedArray = `{${updatedLikes.join(',')}}`

        await sql`UPDATE creations SET likes = ${formattedArray}::text[] WHERE id = ${id}`

        res.json({ success: true, message })

    } catch (error) {
        res.json({ success: false, message: error })
    }
}