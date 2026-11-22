/* ========================================================================== */
/* --- File: src/components/BookPurchaseInfo.jsx ---                        */
/* --- Displays book purchase/reading options (ISBN, links, price) ---      */
/* ========================================================================== */
import React from 'react';
import { DollarSignIcon, LibraryIcon, ExternalLinkIcon, InfoIcon, BookOpenCheckIcon } from 'lucide-react'; // Added BookOpenCheckIcon

const BookPurchaseInfo = ({ details, externalId }) => {
    if (!details && !externalId) {
        return <p className="text-gray-400">Detailed purchase and reading information is currently unavailable.</p>;
    }

    // Construct WorldCat link if ISBN (externalId) is available
    const worldcatUrl = externalId ? `https://www.worldcat.org/isbn/${externalId}` : null;

    const amazonUrl =
        details?.amazonPurchaseUrl ||
        details?.amazonPurchaseUrl_api ||
        (externalId ? `https://www.amazon.com/s?k=${externalId}&i=stripbooks` : null);

    const previewLink = details?.googleBooksPreviewLink || details?.googleBooksPreviewLink_api || null;
    const rawRetailAmt = details?.retailPriceAmount ?? details?.retailPriceAmount_api;
    const rawRetailCur = details?.retailPriceCurrency || details?.retailPriceCurrency_api;
    const rawListAmt = details?.listPriceAmount ?? details?.listPriceAmount_api;
    const rawListCur = details?.listPriceCurrency || details?.listPriceCurrency_api;
    const saleability = details?.saleabilityGoogle || details?.saleabilityGoogle_api || null;
    const isEbook = details?.isEbookGoogle ?? details?.isEbookGoogle_api;

    const formatPrice = (amount, currency) => {
        if (amount === null || amount === undefined || !currency) return 'N/A';
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount);
        } catch (e) {
            console.warn("Price formatting error:", e);
            return `${amount} ${currency}`;
        }
    };
    
    const retailPrice = rawRetailAmt !== null && rawRetailAmt !== undefined
                        ? formatPrice(rawRetailAmt, rawRetailCur)
                        : null;
    const listPrice = rawListAmt !== null && rawListAmt !== undefined
                      ? formatPrice(rawListAmt, rawListCur)
                      : null;

    return (
        <div className="space-y-4 text-sm">
            {externalId && (
                <p className="flex items-center">
                    <InfoIcon size={16} className="mr-2 text-gray-400" />
                    <strong className="text-gray-300">ISBN-13:</strong>
                    <span className="ml-1 text-gray-200">{externalId}</span>
                </p>
            )}

            {previewLink && (
                <a
                    href={previewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-amber-500 hover:text-amber-400 transition-colors"
                >
                    <BookOpenCheckIcon size={16} className="mr-2" />
                    Read a Preview on Google Books
                    <ExternalLinkIcon size={14} className="ml-1 opacity-70" />
                </a>
            )}

            {amazonUrl && (
                <a
                    href={amazonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-amber-500 hover:text-amber-400 transition-colors"
                >
                    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" alt="Amazon" className="h-4 mr-2 filter invert dark:filter-none" />
                    Find on Amazon
                    <ExternalLinkIcon size={14} className="ml-1 opacity-70" />
                </a>
            )}

            {worldcatUrl && (
                <a
                    href={worldcatUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-amber-500 hover:text-amber-400 transition-colors"
                >
                    <LibraryIcon size={16} className="mr-2" />
                    Find in a Library (WorldCat)
                    <ExternalLinkIcon size={14} className="ml-1 opacity-70" />
                </a>
            )}
            
            {(retailPrice || listPrice) && (
                 <div className="pt-2">
                    <p className="flex items-center text-gray-300">
                        <DollarSignIcon size={16} className="mr-2 text-gray-400" />
                        <strong>Pricing:</strong>
                    </p>
                    <ul className="list-disc list-inside ml-6 text-gray-400">
                        {retailPrice && retailPrice !== 'N/A' && (
                            <li>Retail Price: <span className="text-gray-200">{retailPrice}</span></li>
                        )}
                        {listPrice && listPrice !== 'N/A' && retailPrice !== listPrice && ( // Show list price if different from retail
                            <li>List Price: <span className="text-gray-200">{listPrice}</span></li>
                        )}
                         {!retailPrice && !listPrice && <li>Price information not available.</li>}
                    </ul>
                </div>
            )}

            {saleability && (
                 <p className="text-xs text-gray-500 mt-3">
                    Availability on Google Play: {saleability.replace(/_/g, ' ').toLowerCase()}
                    {isEbook ? ' (eBook available)' : ''}
                </p>
            )}
        </div>
    );
};

export default BookPurchaseInfo;
