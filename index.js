
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const Book = mongoose.model(
  "Book",
  new mongoose.Schema({
    title: { type: String, required: true, trim: true, minlength: 1 },
    author: { type: String, required: true },
    year: { type: Number, required: true },
    genres: { type: [String], default: [] }
  }),
  "books"
);

const db = () => mongoose.connection.db;

const fail = (res, error) =>
  res.status(500).json({ error: error.message });

app.get("/", (req, res) => {
  res.json({ message: "Assignment 7 API is running" });
});

app.post("/collection/books", async (req, res) => {
  try {
    const exists = await db().listCollections({ name: "books" }).hasNext();

    if (!exists) {
      await db().createCollection("books", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["title"],
            properties: {
              title: { bsonType: "string", minLength: 1 }
            }
          }
        }
      });
    }

    res.json({ ok: 1 });
  } catch (error) {
    fail(res, error);
  }
});

app.post("/collection/authors", async (req, res) => {
  try {
    const author = req.body.name
      ? req.body
      : { name: "Author1", nationality: "British" };

    const result = await db().collection("authors").insertOne(author);

    res.status(201).json({
      acknowledged: result.acknowledged,
      insertedId: result.insertedId
    });
  } catch (error) {
    fail(res, error);
  }
});

app.post("/collection/logs/capped", async (req, res) => {
  try {
    const exists = await db().listCollections({ name: "logs" }).hasNext();

    if (!exists) {
      await db().createCollection("logs", {
        capped: true,
        size: 1048576
      });
    }

    res.json({ ok: 1 });
  } catch (error) {
    fail(res, error);
  }
});

app.post("/collection/books/index", async (req, res) => {
  try {
    const index = await db().collection("books").createIndex({ title: 1 });
    res.json({ index });
  } catch (error) {
    fail(res, error);
  }
});

app.post("/books", async (req, res) => {
  try {
    const book = await Book.create(req.body);
    res.status(201).json(book);
  } catch (error) {
    fail(res, error);
  }
});

app.post("/books/batch", async (req, res) => {
  try {
    const books = Array.isArray(req.body) && req.body.length
      ? req.body
      : [
          {
            title: "Brave New World",
            author: "Aldous Huxley",
            year: 1932,
            genres: ["Science Fiction"]
          },
          {
            title: "Future",
            author: "Sample Author",
            year: 2020,
            genres: ["Science Fiction"]
          },
          {
            title: "The Hobbit",
            author: "J.R.R. Tolkien",
            year: 1937,
            genres: ["Fantasy"]
          },
          {
            title: "Dune",
            author: "Frank Herbert",
            year: 1965,
            genres: ["Science Fiction"]
          },
          {
            title: "The Martian",
            author: "Andy Weir",
            year: 2011,
            genres: ["Science Fiction"]
          },
          {
            title: "The Shining",
            author: "Stephen King",
            year: 1977,
            genres: ["Horror"]
          },
          {
            title: "The Hunger Games",
            author: "Suzanne Collins",
            year: 2008,
            genres: ["Science Fiction", "Adventure"]
          }
        ];

    if (books.length < 3) {
      return res.status(400).json({ error: "Provide at least 3 books" });
    }

    res.status(201).json(await Book.insertMany(books));
  } catch (error) {
    fail(res, error);
  }
});

app.post("/logs", async (req, res) => {
  try {
    const rawId = req.body.book_id;

    const bookId =
      typeof rawId === "string" && /^[0-9a-fA-F]{24}$/.test(rawId)
        ? new mongoose.Types.ObjectId(rawId)
        : rawId || null;

    const result = await db().collection("logs").insertOne({
      book_id: bookId,
      action: req.body.action || "borrowed",
      createdAt: new Date()
    });

    res.status(201).json(result);
  } catch (error) {
    fail(res, error);
  }
});

app.patch("/books/Future", async (req, res) => {
  try {
    res.json(
      await Book.updateOne(
        { title: "Future" },
        { $set: { year: 2022 } }
      )
    );
  } catch (error) {
    fail(res, error);
  }
});

app.get("/books/title", async (req, res) => {
  try {
    res.json(
      await Book.find({
        title: req.query.title || "Brave New World"
      })
    );
  } catch (error) {
    fail(res, error);
  }
});

app.get("/books/year-range", async (req, res) => {
  try {
    res.json(await Book.find({ year: { $gte: 1990, $lte: 2010 } }));
  } catch (error) {
    fail(res, error);
  }
});

app.get("/books/genre", async (req, res) => {
  try {
    res.json(await Book.find({ genres: "Science Fiction" }));
  } catch (error) {
    fail(res, error);
  }
});

app.get("/books/paginated", async (req, res) => {
  try {
    res.json(await Book.find().sort({ year: -1 }).skip(2).limit(3));
  } catch (error) {
    fail(res, error);
  }
});

app.get("/books/year-integer", async (req, res) => {
  try {
    res.json(
      await db().collection("books")
        .find({ year: { $type: "int" } })
        .toArray()
    );
  } catch (error) {
    fail(res, error);
  }
});

app.get("/books/exclude-genres", async (req, res) => {
  try {
    res.json(
      await Book.find({
        genres: { $nin: ["Horror", "Science Fiction"] }
      })
    );
  } catch (error) {
    fail(res, error);
  }
});

app.delete("/books/before-2000", async (req, res) => {
  try {
    res.json(await Book.deleteMany({ year: { $lt: 2000 } }));
  } catch (error) {
    fail(res, error);
  }
});

app.get("/books/aggregation/sort", async (req, res) => {
  try {
    res.json(
      await Book.aggregate([
        { $match: { year: { $gt: 2000 } } },
        { $sort: { year: -1 } }
      ])
    );
  } catch (error) {
    fail(res, error);
  }
});

app.get("/books/aggregation/project", async (req, res) => {
  try {
    res.json(
      await Book.aggregate([
        { $match: { year: { $gt: 2000 } } },
        { $project: { _id: 0, title: 1, author: 1, year: 1 } }
      ])
    );
  } catch (error) {
    fail(res, error);
  }
});

app.get("/books/aggregation/unwind", async (req, res) => {
  try {
    res.json(await Book.aggregate([{ $unwind: "$genres" }]));
  } catch (error) {
    fail(res, error);
  }
});

app.get("/logs/aggregation/books", async (req, res) => {
  try {
    res.json(
      await db().collection("logs").aggregate([
        {
          $lookup: {
            from: "books",
            let: { logBookId: "$book_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$logBookId"] }
                }
              }
            ],
            as: "book_details"
          }
        }
      ]).toArray()
    );
  } catch (error) {
    fail(res, error);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(error => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
