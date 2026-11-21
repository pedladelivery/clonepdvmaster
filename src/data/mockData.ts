import categoryAlmoco from "@/assets/category-almoco.jpg";
import categoryBebidas from "@/assets/category-bebidas.jpg";
import categoryLanches from "@/assets/category-lanches.jpg";
import categorySobremesas from "@/assets/category-sobremesas.jpg";

export const categories = [
  {
    id: "todos",
    name: "Todos produtos",
    image: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTcgN0gxN1Y5SDdWN1oiIGZpbGw9IiM2Njg1OTkiLz4KPHBhdGggZD0iTTcgMTFIMTdWMTNIN1YxMVoiIGZpbGw9IiM2Njg1OTkiLz4KPHBhdGggZD0iTTcgMTVIMTdWMTdIN1YxNVoiIGZpbGw9IiM2Njg1OTkiLz4KPC9zdmc+Cg=="
  },
  {
    id: "favoritos",
    name: "Favoritos",
    image: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDIxLjM1TDEwLjU1IDIwLjAzQzUuNCAxNS4zNiAyIDEyLjI4IDIgOC41QzIgNS40MiA0LjQyIDMgNy41IDNDOS4yNCAzIDEwLjkxIDMuODEgMTIgNS4wOUMxMy4wOSAzLjgxIDE0Ljc2IDMgMTYuNSAzQzE5LjU4IDMgMjIgNS40MiAyMiA4LjVDMjIgMTIuMjggMTguNiAxNS4zNiAxMy40NSAyMC4wNEwxMiAyMS4zNVoiIGZpbGw9IiNFRjQ0NDQiLz4KPC9zdmc+Cg=="
  },
  {
    id: "1",
    name: "ALMOÇO",
    image: categoryAlmoco
  },
  {
    id: "batata",
    name: "Batata Recheada",
    image: "https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=300&h=200&fit=crop"
  },
  {
    id: "2", 
    name: "Bebidas",
    image: categoryBebidas
  },
  {
    id: "bolos",
    name: "Bolos",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&h=200&fit=crop"
  },
  {
    id: "cafe",
    name: "Café",
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop"
  },
  {
    id: "hamburguer",
    name: "Hambúrguer",
    image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=300&h=200&fit=crop"
  },
  {
    id: "kits",
    name: "Kits",
    image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300&h=200&fit=crop"
  },
  {
    id: "3",
    name: "Lanches", 
    image: categoryLanches
  },
  {
    id: "natal",
    name: "Natal",
    image: "https://images.unsplash.com/photo-1545328437-12ac81265b87?w=300&h=200&fit=crop"
  },
  {
    id: "4",
    name: "Páscoa",
    image: categorySobremesas
  }
];

export const products = [
  // Almoço
  {
    id: "p1",
    name: "Prato Feito Tradicional",
    description: "Arroz, feijão, bife acebolado, batata frita e salada",
    price: 18.90,
    categoryId: "1",
    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=400&fit=crop"
  },
  {
    id: "p2", 
    name: "Frango Grelhado",
    description: "Frango grelhado com arroz integral, feijão e legumes",
    price: 22.50,
    categoryId: "1",
    image: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=400&fit=crop"
  },
  {
    id: "p3",
    name: "Peixe na Brasa",
    description: "Tilápia grelhada com arroz, pirão e salada verde",
    price: 26.90,
    categoryId: "1", 
    image: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=400&fit=crop"
  },

  // Bebidas
  {
    id: "p4",
    name: "Refrigerante Lata",
    description: "Coca-Cola, Guaraná, Fanta - 350ml",
    price: 4.50,
    categoryId: "2",
    image: "https://images.unsplash.com/photo-1581006852262-e1f7b1d5b5a4?w=400&h=400&fit=crop"
  },
  {
    id: "p5",
    name: "Suco Natural",
    description: "Laranja, acerola, maracujá ou limão - 300ml",
    price: 6.00,
    categoryId: "2",
    image: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&h=400&fit=crop"
  },
  {
    id: "p6",
    name: "Água Mineral",
    description: "Água mineral sem gás - 500ml",
    price: 3.00,
    categoryId: "2",
    image: "https://images.unsplash.com/photo-1560169897-fc0cdbdfa4d5?w=400&h=400&fit=crop"
  },

  // Lanches
  {
    id: "p7",
    name: "X-Burger",
    description: "Hambúrguer, queijo, alface, tomate e maionese",
    price: 15.90,
    categoryId: "3",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop"
  },
  {
    id: "p8",
    name: "X-Bacon",
    description: "Hambúrguer, bacon, queijo, alface, tomate e maionese",
    price: 18.90,
    categoryId: "3",
    image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=400&fit=crop"
  },
  {
    id: "p9",
    name: "Sanduíche Natural",
    description: "Pão integral, frango desfiado, queijo branco e salada",
    price: 12.50,
    categoryId: "3",
    image: "https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=400&h=400&fit=crop"
  },

  // Sobremesas
  {
    id: "p10",
    name: "Pudim de Leite",
    description: "Pudim caseiro com calda de caramelo",
    price: 8.50,
    categoryId: "4",
    image: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=400&fit=crop"
  },
  {
    id: "p11",
    name: "Sorvete 2 Bolas",
    description: "Escolha entre chocolate, morango ou baunilha",
    price: 7.00,
    categoryId: "4",
    image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop"
  },
  {
    id: "p12",
    name: "Torta de Chocolate",
    description: "Fatia da nossa deliciosa torta de chocolate",
    price: 9.90,
    categoryId: "4",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop"
  }
];