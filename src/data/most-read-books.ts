export type Book = {
  id: string;
  title: string;
  author: string;
  cover: string;
  tint: "peach" | "mint" | "butter" | "blush";
};

// Hand-picked most-read books (covers via OpenLibrary covers CDN)
export const mostReadBooks: Book[] = [
  { id: "1", title: "Harry Potter and the Sorcerer's Stone", author: "J.K. Rowling", cover: "https://covers.openlibrary.org/b/isbn/0590353403-L.jpg", tint: "butter" },
  { id: "2", title: "The Little Prince", author: "Antoine de Saint-Exupéry", cover: "https://covers.openlibrary.org/b/isbn/0156012197-L.jpg", tint: "blush" },
  { id: "3", title: "To Kill a Mockingbird", author: "Harper Lee", cover: "https://covers.openlibrary.org/b/isbn/0061120081-L.jpg", tint: "mint" },
  { id: "4", title: "1984", author: "George Orwell", cover: "https://covers.openlibrary.org/b/isbn/0451524934-L.jpg", tint: "peach" },
  { id: "5", title: "Pride and Prejudice", author: "Jane Austen", cover: "https://covers.openlibrary.org/b/isbn/0141439513-L.jpg", tint: "blush" },
  { id: "6", title: "The Alchemist", author: "Paulo Coelho", cover: "https://covers.openlibrary.org/b/isbn/0061122416-L.jpg", tint: "butter" },
  { id: "7", title: "The Great Gatsby", author: "F. Scott Fitzgerald", cover: "https://covers.openlibrary.org/b/isbn/0743273567-L.jpg", tint: "mint" },
  { id: "8", title: "The Hobbit", author: "J.R.R. Tolkien", cover: "https://covers.openlibrary.org/b/isbn/0547928227-L.jpg", tint: "peach" },
  { id: "9", title: "The Catcher in the Rye", author: "J.D. Salinger", cover: "https://covers.openlibrary.org/b/isbn/0316769487-L.jpg", tint: "blush" },
  { id: "10", title: "Charlotte's Web", author: "E.B. White", cover: "https://covers.openlibrary.org/b/isbn/0064400557-L.jpg", tint: "mint" },
  { id: "11", title: "The Diary of a Young Girl", author: "Anne Frank", cover: "https://covers.openlibrary.org/b/isbn/0553296981-L.jpg", tint: "butter" },
  { id: "12", title: "Wonder", author: "R.J. Palacio", cover: "https://covers.openlibrary.org/b/isbn/0375869026-L.jpg", tint: "peach" },
];
