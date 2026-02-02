import Konva from 'konva';

export interface DragDropItem {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDragging?: boolean;
  isMatched?: boolean;
  matchedWith?: string;
}

export interface DropZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accepts: string[]; // IDs of items that can be dropped here
  occupied?: boolean;
  occupiedBy?: string;
}

export interface DragDropConfig {
  containerWidth: number;
  containerHeight: number;
  itemWidth: number;
  itemHeight: number;
  itemSpacing: number;
  margin: number;
  snapToGrid?: boolean;
  allowMultipleDrops?: boolean;
}

export class DragDropHelper {
  private config: DragDropConfig;
  private items: DragDropItem[] = [];
  private dropZones: DropZone[] = [];
  private onItemDrop?: (itemId: string, dropZoneId: string) => boolean;
  private onItemPickup?: (itemId: string) => void;

  constructor(config: DragDropConfig) {
    this.config = config;
  }

  // Initialize items in a grid layout
  initializeItems(itemTexts: string[], startX: number, startY: number): DragDropItem[] {
    this.items = itemTexts.map((text, index) => {
      const row = Math.floor(index / Math.floor((this.config.containerWidth - 2 * this.config.margin) / (this.config.itemWidth + this.config.itemSpacing)));
      const col = index % Math.floor((this.config.containerWidth - 2 * this.config.margin) / (this.config.itemWidth + this.config.itemSpacing));

      return {
        id: `item_${index}`,
        text,
        x: startX + col * (this.config.itemWidth + this.config.itemSpacing),
        y: startY + row * (this.config.itemHeight + this.config.itemSpacing),
        width: this.config.itemWidth,
        height: this.config.itemHeight,
        isDragging: false,
        isMatched: false
      };
    });

    return this.items;
  }

  // Initialize drop zones in a grid layout
  initializeDropZones(count: number, startX: number, startY: number): DropZone[] {
    this.dropZones = Array.from({ length: count }, (_, index) => {
      const row = Math.floor(index / Math.floor((this.config.containerWidth - 2 * this.config.margin) / (this.config.itemWidth + this.config.itemSpacing)));
      const col = index % Math.floor((this.config.containerWidth - 2 * this.config.margin) / (this.config.itemWidth + this.config.itemSpacing));

      return {
        id: `dropzone_${index}`,
        x: startX + col * (this.config.itemWidth + this.config.itemSpacing),
        y: startY + row * (this.config.itemHeight + this.config.itemSpacing),
        width: this.config.itemWidth,
        height: this.config.itemHeight,
        accepts: [], // Will be set by the specific activity
        occupied: false
      };
    });

    return this.dropZones;
  }

  // Set drop zone acceptance rules
  setDropZoneAccepts(dropZoneId: string, acceptedItemIds: string[]) {
    const dropZone = this.dropZones.find(dz => dz.id === dropZoneId);
    if (dropZone) {
      dropZone.accepts = acceptedItemIds;
    }
  }

  // Handle drag start
  handleDragStart(itemId: string): DragDropItem | null {
    const item = this.items.find(i => i.id === itemId);
    if (item && !item.isMatched) {
      item.isDragging = true;
      this.onItemPickup?.(itemId);
      return item;
    }
    return null;
  }

  // Handle drag end and check for drops
  handleDragEnd(itemId: string, finalX: number, finalY: number): { success: boolean; dropZoneId?: string; item?: DragDropItem } {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return { success: false };

    item.isDragging = false;

    // Check if dropped on any drop zone
    for (const dropZone of this.dropZones) {
      if (this.isPointInDropZone(finalX, finalY, dropZone) || this.isItemInDropZone(item, dropZone)) {
        // Check if drop zone accepts this item
        if (dropZone.accepts.includes(itemId)) {
          // Check if drop zone is already occupied
          if (dropZone.occupied && !this.config.allowMultipleDrops) {
            // Reset item position
            this.resetItemPosition(item);
            return { success: false };
          }

          // Successful drop
          const success = this.onItemDrop?.(itemId, dropZone.id) ?? true;
          if (success) {
            item.isMatched = true;
            item.matchedWith = dropZone.id;
            dropZone.occupied = true;
            dropZone.occupiedBy = itemId;

            // Snap item to drop zone center
            if (this.config.snapToGrid) {
              item.x = dropZone.x + (dropZone.width - item.width) / 2;
              item.y = dropZone.y + (dropZone.height - item.height) / 2;
            }

            return { success: true, dropZoneId: dropZone.id, item };
          }
        }

        // Reset item position
        this.resetItemPosition(item);
        return { success: false };
      }
    }

    // No valid drop zone found, reset position
    this.resetItemPosition(item);
    return { success: false };
  }

  // Check if a point is within a drop zone
  private isPointInDropZone(x: number, y: number, dropZone: DropZone): boolean {
    return (
      x >= dropZone.x &&
      x <= dropZone.x + dropZone.width &&
      y >= dropZone.y &&
      y <= dropZone.y + dropZone.height
    );
  }

  // Check if an item overlaps with a drop zone
  private isItemInDropZone(item: DragDropItem, dropZone: DropZone): boolean {
    return !(
      item.x + item.width < dropZone.x ||
      item.x > dropZone.x + dropZone.width ||
      item.y + item.height < dropZone.y ||
      item.y > dropZone.y + dropZone.height
    );
  }

  // Reset item to original position
  private resetItemPosition(item: DragDropItem) {
    // Find original position (this would need to be stored when items are initialized)
    // For now, just keep current position
    item.isDragging = false;
  }

  // Get all items
  getItems(): DragDropItem[] {
    return this.items;
  }

  // Get all drop zones
  getDropZones(): DropZone[] {
    return this.dropZones;
  }

  // Set event handlers
  setOnItemDrop(handler: (itemId: string, dropZoneId: string) => boolean) {
    this.onItemDrop = handler;
  }

  setOnItemPickup(handler: (itemId: string) => void) {
    this.onItemPickup = handler;
  }

  // Reset all items and drop zones
  reset() {
    this.items.forEach(item => {
      item.isDragging = false;
      item.isMatched = false;
      item.matchedWith = undefined;
    });

    this.dropZones.forEach(dropZone => {
      dropZone.occupied = false;
      dropZone.occupiedBy = undefined;
    });
  }

  // Get completion status
  getCompletionStatus(): { completed: number; total: number; percentage: number } {
    const total = this.items.length;
    const completed = this.items.filter(item => item.isMatched).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }
}

// Utility function to calculate responsive dimensions
export const calculateResponsiveDimensions = (
  screenWidth: number,
  screenHeight: number,
  baseItemWidth: number = 140,
  baseItemHeight: number = 50,
  baseSpacing: number = 80,
  baseMargin: number = 50
) => {
  const breakpoints = {
    VERY_SMALL: 400,
    MOBILE: 600,
    TABLET: 900
  };

  const scales = {
    VERY_SMALL: 0.6,
    MOBILE: 0.8,
    TABLET: 0.9,
    DESKTOP: 1.0
  };

  const isVerySmall = screenWidth < breakpoints.VERY_SMALL;
  const isMobile = screenWidth >= breakpoints.VERY_SMALL && screenWidth < breakpoints.MOBILE;
  const isTablet = screenWidth >= breakpoints.MOBILE && screenWidth < breakpoints.TABLET;
  const isDesktop = screenWidth >= breakpoints.TABLET;

  const scale = isVerySmall ? scales.VERY_SMALL :
               isMobile ? scales.MOBILE :
               isTablet ? scales.TABLET : scales.DESKTOP;

  return {
    itemWidth: Math.round(baseItemWidth * scale),
    itemHeight: Math.round(baseItemHeight * scale),
    itemSpacing: Math.round(baseSpacing * scale),
    margin: Math.round(baseMargin * scale),
    scale
  };
};
