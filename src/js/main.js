// src/js/main.js
// Главный модуль инициализации приложения

import "../css/main.css";
import "../css/shop.css";

// ===== ИМПОРТЫ МОДУЛЕЙ =====
import { showToast } from './utils.js';
import { changeItemsPerPage, changePage, handlePageInputKeydown } from './pagination.js';
import { filterByBrandOrSeries, applyFilters, clearAllFilters } from './filters.js';
import { loadAvailability } from './availability.js';
import { addToCart, clearCart, removeFromCart, fetchCart, updateCartItem } from './cart.js';
import { renderProductsTable, copyText } from './renderProducts.js';
import { createSpecification } from './specification.js';
import { productsManager } from './ProductsManager.js';
import { cartBadge } from './cart-badge.js';

// ===== ЭКСПОРТ ГЛОБАЛЬНЫХ ФУНКЦИЙ =====
// Для обратной совместимости с inline скриптами
window.showToast = showToast;
window.renderProductsTable = renderProductsTable;
window.copyText = copyText;
window.createSpecification = createSpecification;
window.loadAvailability = loadAvailability;
window.addToCart = addToCart;
window.clearCart = clearCart;
window.removeFromCart = removeFromCart;
window.fetchCart = fetchCart;
window.filterByBrandOrSeries = filterByBrandOrSeries;
window.applyFilters = applyFilters;
window.clearAllFilters = clearAllFilters;
window.productsManager = productsManager;
window.fetchProducts = () => productsManager.fetchProducts();
window.sortProducts = (column) => productsManager.sortProducts(column);
window.loadPage = (page) => productsManager.loadPage(page);
window.updateCartBadge = () => cartBadge.update();
window.updateCartItem = updateCartItem;

// ===== CSRF TOKEN =====
window.CSRF_TOKEN = window.APP_CONFIG?.csrfToken || '';

// ===== ПОИСК =====
class SearchManager {
    constructor() {
        this.searchInput = null;
        this.globalSearchInput = null;
    }

    init() {
        this.searchInput = document.getElementById('searchInput');
        if (this.searchInput) {
            // Локальный поиск обрабатывается через productsManager
        }

        this.globalSearchInput = document.getElementById('globalSearch');
        if (this.globalSearchInput) {
            this.setupGlobalSearch(this.globalSearchInput);
        }
    }

    setupGlobalSearch(input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                window.location.href = `/shop?search=${encodeURIComponent(input.value.trim())}`;
            }
        });
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 App initializing...');
    
    // Инициализация глобальных переменных
    window.productsData = [];
    window.currentPage = 1;
    window.itemsPerPage = 20;
    window.totalProducts = 0;
    window.sortColumn = 'name';
    window.sortDirection = 'asc';
    window.appliedFilters = {};

    // Инициализация модулей
    const searchManager = new SearchManager();
    searchManager.init();
    cartBadge.init();
    
    // Город
    const citySelect = document.getElementById('citySelect');
    if (citySelect) {
        citySelect.value = localStorage.getItem('selected_city_id') || '1';
        citySelect.addEventListener('change', () => {
            localStorage.setItem('selected_city_id', citySelect.value);
            showToast(`Город изменен на ${citySelect.options[citySelect.selectedIndex].text}`, false);
            
            // Перезагружаем товары при смене города
            if (window.productsData && window.productsData.length > 0) {
                productsManager.fetchProducts();
            }
        });
    }
    
    // Количество товаров на странице
    ['itemsPerPageSelect', 'itemsPerPageSelectBottom'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = window.itemsPerPage;
            el.addEventListener('change', changeItemsPerPage);
        }
    });
    
    // Ввод номера страницы
    ['pageInput', 'pageInputBottom'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', changePage);
            el.addEventListener('keydown', handlePageInputKeydown);
        }
    });
    
    // Обработчики кликов
    document.body.addEventListener('click', handleBodyClick);
    
    // Кнопки пагинации
    document.querySelectorAll('.prev-btn').forEach(btn => {
        btn.addEventListener('click', evt => {
            evt.preventDefault();
            productsManager.loadPage(Math.max(1, window.currentPage - 1));
        });
    });
    
    document.querySelectorAll('.next-btn').forEach(btn => {
        btn.addEventListener('click', evt => {
            evt.preventDefault();
            const totalPages = Math.ceil(window.totalProducts / window.itemsPerPage);
            productsManager.loadPage(Math.min(totalPages, window.currentPage + 1));
        });
    });
    
    // Загрузка товаров
    if (document.querySelector('.product-table')) {
        setTimeout(() => {
            productsManager.fetchProducts();
        }, 100);
    }
    
    // Загрузка корзины
    if (document.querySelector('.cart-container') || document.getElementById('cartBadge')) {
        fetchCart().catch(console.error);
    }
    
    console.log('✅ App initialized successfully');
});

// ===== ОБРАБОТЧИК КЛИКОВ =====
function handleBodyClick(e) {
    const target = e.target;
    
    // Добавить в корзину
    if (target.closest('.add-to-cart-btn')) {
        const btn = target.closest('.add-to-cart-btn');
        const productId = btn.dataset.productId;
        const quantityInput = btn.closest('tr')?.querySelector('.quantity-input');
        const quantity = parseInt(quantityInput?.value || '1', 10);
        addToCart(productId, quantity);
        return;
    }
    
    // Удалить из корзины
    if (target.closest('.remove-from-cart-btn')) {
        const btn = target.closest('.remove-from-cart-btn');
        removeFromCart(btn.dataset.productId);
        return;
    }
    
    // Очистить корзину
    if (target.matches('#clearCartBtn')) {
        if (confirm('Очистить корзину?')) {
            clearCart();
        }
        return;
    }
    
    // Создать спецификацию
    if (target.closest('.create-specification-btn, #createSpecLink')) {
        e.preventDefault();
        createSpecification();
        return;
    }
    
    // Сортировка
    const sortableHeader = target.closest('th.sortable');
    if (sortableHeader && sortableHeader.dataset.column) {
        productsManager.sortProducts(sortableHeader.dataset.column);
        return;
    }
    
    // Фильтры по бренду/серии
    if (target.closest('.brand-name, .series-name')) {
        const element = target.closest('.brand-name, .series-name');
        const filterType = element.classList.contains('brand-name') ? 'brand_name' : 'series_name';
        const value = element.textContent.trim();
        filterByBrandOrSeries(filterType, value);
        return;
    }
}